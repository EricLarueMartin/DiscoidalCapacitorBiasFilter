#!/usr/bin/env python3
"""Optional FEniCSx/DOLFINx electrostatic solver.

The finite-difference solver is useful for quick screening, but its point peak
near rounded conductor edges is grid-sensitive. This module provides the first
conforming r-z finite-element path: Gmsh builds a dielectric domain with the
conductors removed as holes, DOLFINx solves the cylindrical weak form, and the
solution is sampled back onto the browser's r-z grid for comparison.
"""

from __future__ import annotations

import argparse
import importlib.metadata
import importlib.util
import json
import math
from typing import Any

import axisymmetric_model


REQUIRED_MODULES = {
    "dolfinx": "python3-dolfinx / fenicsx",
    "ufl": "python3-ufl",
    "mpi4py": "python3-mpi4py",
    "petsc4py": "python3-petsc4py",
    "gmsh": "python3-gmsh",
}

APT_INSTALL_HINT = "sudo apt install fenicsx gmsh python3-gmsh python3-dolfinx"
FENICSX_FILTER_SOLVER_IMPLEMENTED = True
PHYSICAL_DIELECTRIC_TAG = 1
GEOMETRY_TOLERANCE_MM = 1e-9
BOUNDARY_MARKER_TOLERANCE_MM = 1e-5
EPSILON_0_PF_PER_MM = 8.8541878128e-3


def module_version(module_name: str) -> str | None:
    """Best-effort package version lookup without importing heavy modules."""
    candidates = {
        "dolfinx": ["fenics-dolfinx", "dolfinx"],
        "ufl": ["fenics-ufl", "ufl"],
        "gmsh": ["gmsh"],
        "mpi4py": ["mpi4py"],
        "petsc4py": ["petsc4py"],
    }.get(module_name, [module_name])
    for candidate in candidates:
        try:
            return importlib.metadata.version(candidate)
        except importlib.metadata.PackageNotFoundError:
            continue
    return None


def dependency_status() -> dict[str, Any]:
    modules: dict[str, dict[str, Any]] = {}
    missing: list[str] = []
    for module_name, package_hint in REQUIRED_MODULES.items():
        available = importlib.util.find_spec(module_name) is not None
        modules[module_name] = {
            "available": available,
            "packageHint": package_hint,
            "version": module_version(module_name) if available else None,
        }
        if not available:
            missing.append(module_name)
    return {
        "backend": "fenicsx",
        "available": not missing,
        "implemented": FENICSX_FILTER_SOLVER_IMPLEMENTED,
        "ready": not missing and FENICSX_FILTER_SOLVER_IMPLEMENTED,
        "missing": missing,
        "modules": modules,
        "installHint": APT_INSTALL_HINT,
        "equation": axisymmetric_weak_form_summary(),
        "meshPlan": mesh_plan_summary(),
    }


def axisymmetric_weak_form_summary() -> dict[str, str]:
    return {
        "strongForm": "div(epsilon_r grad(V)) = 0 in cylindrical r-z geometry",
        "weakForm": "integral_Omega 2*pi*r*epsilon_r*grad(V).grad(w) dr dz = 0",
        "dirichlet": "HV core and HV plates at bias_voltage_v; ground plates and optional tube at 0 V",
        "natural": "Open outer model boundaries use zero-normal-flux unless replaced by a larger grounded boundary.",
    }


def mesh_plan_summary() -> dict[str, Any]:
    return {
        "geometry": "Generate the r-z dielectric domain with Gmsh/OpenCASCADE and remove conductor regions as holes.",
        "cellTags": ["epoxy", "washer"],
        "facetTags": ["hv", "ground", "axis_or_open"],
        "initialRefinement": [
            "Set small Gmsh sizes on rounded HV outer edges.",
            "Set small Gmsh sizes on rounded ground inner edges.",
            "Refine dielectric-interface endpoints near plate overlap boundaries.",
        ],
        "adaptiveLoop": [
            "Solve on the conforming mesh.",
            "Estimate field and/or flux-jump error by cell.",
            "Refine marked cells or remesh with tighter Gmsh size fields.",
            "Stop when peak field and peak location converge.",
        ],
    }


def _import_fenicsx_modules() -> dict[str, Any]:
    missing = [module for module in REQUIRED_MODULES if importlib.util.find_spec(module) is None]
    if missing:
        raise RuntimeError(
            f"FEniCSx backend dependencies are missing: {', '.join(missing)}. "
            f"Install with: {APT_INSTALL_HINT}"
        )

    import gmsh  # type: ignore
    import numpy as np  # type: ignore
    import ufl  # type: ignore
    from dolfinx import fem, geometry, io  # type: ignore
    from dolfinx.fem import petsc as fem_petsc  # type: ignore
    from mpi4py import MPI  # type: ignore
    from petsc4py import PETSc  # type: ignore

    return {
        "gmsh": gmsh,
        "np": np,
        "ufl": ufl,
        "fem": fem,
        "geometry": geometry,
        "gmshio": io.gmshio,
        "fem_petsc": fem_petsc,
        "MPI": MPI,
        "PETSc": PETSc,
    }


def _function_space(fem: Any, mesh: Any, family_degree: tuple[str, int]) -> Any:
    if hasattr(fem, "functionspace"):
        return fem.functionspace(mesh, family_degree)
    return fem.FunctionSpace(mesh, family_degree)


def _linear_problem(fem_petsc: Any, a: Any, l_form: Any, bcs: list[Any], petsc_options: dict[str, str] | None = None) -> Any:
    options = petsc_options or {"ksp_type": "preonly", "pc_type": "lu"}
    return fem_petsc.LinearProblem(a, l_form, bcs=bcs, petsc_options=options)


def _polygon_surface(gmsh: Any, profile: list[tuple[float, float]], mesh_size: float) -> int:
    points: list[int] = []
    for r, z in profile:
        points.append(gmsh.model.occ.addPoint(float(r), float(z), 0.0, mesh_size))
    lines = [
        gmsh.model.occ.addLine(points[index], points[(index + 1) % len(points)])
        for index in range(len(points))
    ]
    loop = gmsh.model.occ.addCurveLoop(lines)
    return gmsh.model.occ.addPlaneSurface([loop])


def _same_point(a: tuple[float, float], b: tuple[float, float], tolerance: float = GEOMETRY_TOLERANCE_MM) -> bool:
    return abs(a[0] - b[0]) <= tolerance and abs(a[1] - b[1]) <= tolerance


def _clean_polygon(profile: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Remove zero-length edges created by clipping rounded profiles."""
    cleaned: list[tuple[float, float]] = []
    for point in profile:
        if cleaned and _same_point(cleaned[-1], point):
            continue
        cleaned.append(point)
    while len(cleaned) > 1 and _same_point(cleaned[0], cleaned[-1]):
        cleaned.pop()
    return cleaned


def _mesh_sizes(p: dict[str, Any]) -> dict[str, float]:
    edge_radius = max(float(axisymmetric_model.edge_radius_mm(p)), 0.02)
    try:
        edge_ratio = float(p.get("mesh_edge_radius_ratio", 0.2))
    except (TypeError, ValueError):
        edge_ratio = 0.2
    if edge_ratio != edge_ratio:
        edge_ratio = 0.2
    edge_ratio = max(0.005, min(2.0, edge_ratio))
    smallest_gap = min(
        float(p["plate_gap_mm"]),
        float(p["core_to_ground_gap_mm"]),
        float(p["hv_to_tube_gap_mm"]),
    )
    gap_limiter = smallest_gap / 8.0
    fine = max(0.006, min(edge_radius * edge_ratio, gap_limiter))
    coarse = max(fine * 4.0, min(0.75, smallest_gap / 2.0, edge_radius * 1.5))
    return {
        "fine": fine,
        "coarse": coarse,
        "edge_radius_ratio": edge_ratio,
        "edge_radius_mm": edge_radius,
        "gap_limiter_mm": gap_limiter,
    }


def _build_gmsh_model(p: dict[str, Any], modules: dict[str, Any], include_core_dielectric: bool = False) -> dict[str, float]:
    gmsh = modules["gmsh"]
    sizes = _mesh_sizes(p)
    length = axisymmetric_model.stack_length_mm(p)
    core_r = p["core_od_mm"] / 2.0
    tube_inner = p["tube_id_mm"] / 2.0
    r_min = 0.0 if include_core_dielectric else core_r

    gmsh.initialize()
    gmsh.model.add("shv_bias_filter_axisymmetric")
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.option.setNumber("Mesh.CharacteristicLengthMin", sizes["fine"])
    gmsh.option.setNumber("Mesh.CharacteristicLengthMax", sizes["coarse"])
    gmsh.option.setNumber("Mesh.Algorithm", 6)

    domain = gmsh.model.occ.addRectangle(r_min, 0.0, 0.0, tube_inner - r_min, length)
    tools: list[tuple[int, int]] = []
    for component in axisymmetric_model.component_profiles(p):
        if component["material"] not in {"hv", "ground"}:
            continue
        profile = [
            (min(max(float(r), r_min), tube_inner), min(max(float(z), 0.0), length))
            for r, z in component["profile"]
        ]
        profile = _clean_polygon(profile)
        # Skip degenerate intersections, such as a conductor entirely outside
        # the dielectric solve domain.
        if len(profile) < 3:
            continue
        if max(r for r, _ in profile) - min(r for r, _ in profile) <= GEOMETRY_TOLERANCE_MM:
            continue
        if max(z for _, z in profile) - min(z for _, z in profile) <= GEOMETRY_TOLERANCE_MM:
            continue
        tools.append((2, _polygon_surface(gmsh, profile, sizes["fine"])))

    gmsh.model.occ.synchronize()
    if tools:
        try:
            gmsh.model.occ.cut([(2, domain)], tools, removeObject=True, removeTool=True)
            gmsh.model.occ.synchronize()
        except Exception as exc:
            raise RuntimeError(f"Gmsh failed to remove conductor regions from the dielectric domain: {exc}") from exc

    surfaces = gmsh.model.getEntities(2)
    if not surfaces:
        raise RuntimeError("Gmsh produced no dielectric surfaces for the FEniCSx solve.")
    gmsh.model.addPhysicalGroup(2, [tag for _, tag in surfaces], PHYSICAL_DIELECTRIC_TAG)
    gmsh.model.setPhysicalName(2, PHYSICAL_DIELECTRIC_TAG, "dielectric")
    gmsh.model.mesh.generate(2)
    return sizes


def _model_to_mesh(modules: dict[str, Any]) -> Any:
    gmsh = modules["gmsh"]
    gmshio = modules["gmshio"]
    MPI = modules["MPI"]
    converted = gmshio.model_to_mesh(gmsh.model, MPI.COMM_WORLD, 0, gdim=2)
    if hasattr(converted, "mesh"):
        return converted.mesh
    return converted[0]


def _tolerant_classifies_as(p: dict[str, Any], r: float, z: float, wanted: str) -> bool:
    """Classify FEA boundary nodes with a tiny tolerance around conductor faces.

    Boolean operations in Gmsh can return boundary coordinates just outside an
    ideal interval such as z = plate_face - 1e-14. The exact geometry classifier
    is intentionally sharp for browser sampling, but Dirichlet tags need this
    tolerance or one side of a plate face can be left floating.
    """
    length = axisymmetric_model.stack_length_mm(p)
    tolerance = BOUNDARY_MARKER_TOLERANCE_MM
    for dr, dz in (
        (0.0, 0.0),
        (0.0, tolerance),
        (0.0, -tolerance),
        (tolerance, 0.0),
        (-tolerance, 0.0),
        (tolerance, tolerance),
        (tolerance, -tolerance),
        (-tolerance, tolerance),
        (-tolerance, -tolerance),
    ):
        rr = max(0.0, r + dr)
        zz = min(max(z + dz, 0.0), length)
        label, _ = axisymmetric_model.classify_point(p, rr, zz)
        if label == wanted:
            return True
    return False


def _point_segment_distance(point: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    px, py = point
    ax, ay = a
    bx, by = b
    dx = bx - ax
    dy = by - ay
    denom = dx * dx + dy * dy
    if denom <= 0.0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _point_in_polygon_or_on_boundary(
    point: tuple[float, float],
    polygon: list[tuple[float, float]],
    tolerance: float = BOUNDARY_MARKER_TOLERANCE_MM,
) -> bool:
    if len(polygon) < 3:
        return False
    for index, vertex in enumerate(polygon):
        if _point_segment_distance(point, vertex, polygon[(index + 1) % len(polygon)]) <= tolerance:
            return True

    x, y = point
    inside = False
    previous = polygon[-1]
    for current in polygon:
        xi, yi = current
        xj, yj = previous
        intersects = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-300) + xi
        )
        if intersects:
            inside = not inside
        previous = current
    return inside


def _component_marker(
    p: dict[str, Any],
    modules: dict[str, Any],
    names: set[str] | None = None,
    materials: set[str] | None = None,
) -> Any:
    np = modules["np"]
    length = axisymmetric_model.stack_length_mm(p)
    components = [
        component
        for component in axisymmetric_model.component_profiles(p)
        if (names is None or component["name"] in names)
        and (materials is None or component["material"] in materials)
    ]

    def marker(x: Any) -> Any:
        values: list[bool] = []
        for r, z in zip(x[0], x[1]):
            rr = max(0.0, float(r))
            zz = min(max(float(z), 0.0), length)
            values.append(any(
                _point_in_polygon_or_on_boundary((rr, zz), component["profile"])
                for component in components
            ))
        return np.array(values, dtype=bool)

    return marker


def _marker_from_classification(p: dict[str, Any], wanted: str, modules: dict[str, Any]) -> Any:
    np = modules["np"]

    def marker(x: Any) -> Any:
        values: list[bool] = []
        for r, z in zip(x[0], x[1]):
            values.append(_tolerant_classifies_as(p, float(r), float(z), wanted))
        return np.array(values, dtype=bool)

    return marker


def _locate_dofs(fem: Any, V: Any, marker: Any) -> Any:
    if hasattr(fem, "locate_dofs_geometrical"):
        return fem.locate_dofs_geometrical(V, marker)
    raise RuntimeError("This DOLFINx version does not expose locate_dofs_geometrical.")


def _dielectric_epsr_expression(mesh: Any, p: dict[str, Any], modules: dict[str, Any], include_core_dielectric: bool = False) -> Any:
    ufl = modules["ufl"]
    x = ufl.SpatialCoordinate(mesh)
    washer_inner, washer_outer = axisymmetric_model.washer_radial_bounds(p)
    core_r = float(p["core_od_mm"]) / 2.0

    def and_condition(*conditions: Any) -> Any:
        condition = conditions[0]
        for next_condition in conditions[1:]:
            condition = ufl.And(condition, next_condition)
        return condition

    radial_washer = and_condition(ufl.ge(x[0], washer_inner), ufl.le(x[0], washer_outer))
    washer_condition = None
    for z0, z1 in axisymmetric_model.washer_gap_intervals(p):
        interval_condition = and_condition(radial_washer, ufl.ge(x[1], z0), ufl.le(x[1], z1))
        washer_condition = interval_condition if washer_condition is None else ufl.Or(washer_condition, interval_condition)
    eps = (
        ufl.conditional(washer_condition, p["washer_epsr"], p["epoxy_epsr"])
        if washer_condition is not None
        else p["epoxy_epsr"]
    )
    if include_core_dielectric:
        eps = ufl.conditional(ufl.le(x[0], core_r), axisymmetric_model.core_capacitance_epsr(p), eps)
    return eps


def _solve_potential_with_dirichlet_markers(
    mesh: Any,
    p: dict[str, Any],
    modules: dict[str, Any],
    dirichlet_markers: list[tuple[float, Any]],
    include_core_dielectric: bool = False,
) -> Any:
    np = modules["np"]
    ufl = modules["ufl"]
    fem = modules["fem"]
    fem_petsc = modules["fem_petsc"]
    PETSc = modules["PETSc"]

    V = _function_space(fem, mesh, ("Lagrange", 1))
    u = ufl.TrialFunction(V)
    v = ufl.TestFunction(V)
    x = ufl.SpatialCoordinate(mesh)
    eps = _dielectric_epsr_expression(mesh, p, modules, include_core_dielectric=include_core_dielectric)
    a = eps * x[0] * ufl.inner(ufl.grad(u), ufl.grad(v)) * ufl.dx
    l_form = fem.Constant(mesh, PETSc.ScalarType(0.0)) * v * ufl.dx

    bcs = []
    assigned = np.array([], dtype=np.int32)
    located_counts: list[int] = []
    for value, marker in dirichlet_markers:
        dofs = np.asarray(_locate_dofs(fem, V, marker), dtype=np.int32)
        located_counts.append(int(len(dofs)))
        if assigned.size:
            dofs = np.setdiff1d(dofs, assigned, assume_unique=False)
        if len(dofs):
            bcs.append(fem.dirichletbc(PETSc.ScalarType(value), dofs, V))
            assigned = np.union1d(assigned, dofs)
    if not bcs:
        raise RuntimeError(f"FEniCSx boundary tagging failed: located_counts={located_counts}")

    problem = _linear_problem(fem_petsc, a, l_form, bcs=bcs)
    uh = problem.solve()
    # Force ghost updates when available before sampling.
    if hasattr(uh.x, "scatter_forward"):
        uh.x.scatter_forward()
    return uh


def _solve_potential(mesh: Any, p: dict[str, Any], modules: dict[str, Any]) -> Any:
    hv_marker = _marker_from_classification(p, "hv", modules)
    ground_marker = _marker_from_classification(p, "ground", modules)
    hv_dofs = _locate_dofs(modules["fem"], _function_space(modules["fem"], mesh, ("Lagrange", 1)), hv_marker)
    ground_dofs = _locate_dofs(modules["fem"], _function_space(modules["fem"], mesh, ("Lagrange", 1)), ground_marker)
    if len(hv_dofs) == 0 or len(ground_dofs) == 0:
        raise RuntimeError(f"FEniCSx boundary tagging failed: hv_dofs={len(hv_dofs)}, ground_dofs={len(ground_dofs)}")
    return _solve_potential_with_dirichlet_markers(
        mesh,
        p,
        modules,
        [
            (float(p["bias_voltage_v"]), hv_marker),
            (0.0, ground_marker),
        ],
    )


def _project_field_magnitude(mesh: Any, uh: Any, modules: dict[str, Any]) -> Any:
    ufl = modules["ufl"]
    fem = modules["fem"]
    fem_petsc = modules["fem_petsc"]

    W = _function_space(fem, mesh, ("DG", 0))
    e_trial = ufl.TrialFunction(W)
    q = ufl.TestFunction(W)
    e_expr = ufl.sqrt(ufl.inner(ufl.grad(uh), ufl.grad(uh)))
    a = ufl.inner(e_trial, q) * ufl.dx
    l_form = ufl.inner(e_expr, q) * ufl.dx
    problem = _linear_problem(fem_petsc, a, l_form, bcs=[])
    eh = problem.solve()
    if hasattr(eh.x, "scatter_forward"):
        eh.x.scatter_forward()
    return eh


def _assemble_global_scalar(mesh: Any, expression: Any, modules: dict[str, Any]) -> float:
    fem = modules["fem"]
    MPI = modules["MPI"]
    form = fem.form(expression) if hasattr(fem, "form") else expression
    local_value = fem.assemble_scalar(form)
    total_value = mesh.comm.allreduce(local_value, op=MPI.SUM) if hasattr(mesh, "comm") else local_value
    return float(getattr(total_value, "real", total_value))


def _capacitance_from_energy(
    mesh: Any,
    uh: Any,
    p: dict[str, Any],
    modules: dict[str, Any],
    voltage_v: float | None = None,
    include_core_dielectric: bool = False,
) -> dict[str, Any]:
    ufl = modules["ufl"]
    x = ufl.SpatialCoordinate(mesh)
    epsr = _dielectric_epsr_expression(mesh, p, modules, include_core_dielectric=include_core_dielectric)
    voltage = abs(float(p["bias_voltage_v"] if voltage_v is None else voltage_v))
    energy_integrand = (
        math.pi
        * x[0]
        * EPSILON_0_PF_PER_MM
        * epsr
        * ufl.inner(ufl.grad(uh), ufl.grad(uh))
        * ufl.dx
    )
    energy_pj = _assemble_global_scalar(mesh, energy_integrand, modules)
    capacitance_pf = 2.0 * energy_pj / (voltage * voltage) if voltage > 0.0 else 0.0
    return {
        "total_pf": capacitance_pf,
        "bias_to_ground_pf": capacitance_pf,
        "energy_pj": energy_pj,
        "voltage_v": voltage,
        "method": "fenicsx-energy",
        "description": "C = 2U/V^2 from the axisymmetric dielectric energy integral.",
    }


def _representative_adjacent_bias_parasitic_capacitance(p: dict[str, Any], modules: dict[str, Any]) -> dict[str, Any] | None:
    """Estimate adjacent bias-plate Cpar using a local three-bias FEA solve.

    The ordinary field solve ties all HV conductors together. For stage-to-stage
    parasitic capacitance we instead drive the middle bias plate to 1 V with the
    two neighboring bias plates and all ground conductors at 0 V. That energy is
    the middle plate's capacitance to ground plus capacitance to both adjacent
    bias plates. A second all-bias-at-1 V solve estimates the representative
    bias-to-ground term, which is subtracted before dividing by two.
    """
    local_p = axisymmetric_model.normalize_parameters({**p, "plate_pairs": 3, "bias_voltage_v": 1.0})
    gmsh = modules["gmsh"]
    mesh_sizes: dict[str, float] | None = None
    try:
        mesh_sizes = _build_gmsh_model(local_p, modules, include_core_dielectric=True)
        mesh = _model_to_mesh(modules)
    finally:
        gmsh.finalize()

    hv_components = [
        component["name"]
        for component in axisymmetric_model.component_profiles(local_p)
        if component["material"] == "hv" and component["name"].startswith("hv_plate_")
    ]
    if len(hv_components) < 3:
        return None
    middle_hv = hv_components[len(hv_components) // 2]
    other_hv = set(hv_components) - {middle_hv}
    ground_marker = _component_marker(local_p, modules, materials={"ground"})

    middle_only = _solve_potential_with_dirichlet_markers(
        mesh,
        local_p,
        modules,
        [
            (1.0, _component_marker(local_p, modules, names={middle_hv})),
            (0.0, _component_marker(local_p, modules, names=other_hv)),
            (0.0, ground_marker),
        ],
        include_core_dielectric=True,
    )
    middle_total = _capacitance_from_energy(
        mesh,
        middle_only,
        local_p,
        modules,
        voltage_v=1.0,
        include_core_dielectric=True,
    )

    all_bias = _solve_potential_with_dirichlet_markers(
        mesh,
        local_p,
        modules,
        [
            (1.0, _component_marker(local_p, modules, names=set(hv_components))),
            (0.0, ground_marker),
        ],
        include_core_dielectric=True,
    )
    all_bias_to_ground = _capacitance_from_energy(
        mesh,
        all_bias,
        local_p,
        modules,
        voltage_v=1.0,
        include_core_dielectric=True,
    )

    representative_ground_pf = all_bias_to_ground["total_pf"] / len(hv_components)
    raw_adjacent_pair_pf = (middle_total["total_pf"] - representative_ground_pf) / 2.0
    adjacent_pair_pf = max(0.0, raw_adjacent_pair_pf)
    return {
        "parasitic_pf": adjacent_pair_pf,
        "adjacent_bias_pf": adjacent_pair_pf,
        "bias_to_bias_pf": adjacent_pair_pf,
        "raw_adjacent_bias_pf": raw_adjacent_pair_pf,
        "middle_to_all_zero_pf": middle_total["total_pf"],
        "local_bias_to_ground_total_pf": all_bias_to_ground["total_pf"],
        "local_bias_to_ground_per_plate_pf": representative_ground_pf,
        "local_bias_plate_count": len(hv_components),
        "middle_bias_plate": middle_hv,
        "method": "fenicsx-three-bias-energy-difference",
        "description": (
            "Representative Cpar = (C_middle_to_all_zero - C_all_bias_to_ground/Nbias)/2 "
            "from a local three-bias-plate solve with the core included as dielectric."
        ),
        "mesh": {
            "target_fine_mm": mesh_sizes.get("fine") if mesh_sizes else None,
            "target_coarse_mm": mesh_sizes.get("coarse") if mesh_sizes else None,
            "edge_radius_ratio": mesh_sizes.get("edge_radius_ratio") if mesh_sizes else None,
        },
    }


def _admittance_from_capacitance(p: dict[str, Any], capacitance_pf: float) -> dict[str, Any]:
    voltage = abs(float(p.get("bias_voltage_v", 0.0)))
    current_a = max(0.0, float(p.get("load_current_na", 1.0))) * 1e-9
    conductance_s = current_a / voltage if voltage > 0.0 else 0.0
    load_resistance_ohm = (1.0 / conductance_s) if conductance_s > 0.0 else None
    rf_frequency_hz = (10.0 ** float(p.get("rf_compare_frequency_log10_mhz", 0.0))) * 1e6
    frequency_hz = sorted({1.0, 10.0, 50.0, 60.0, 100.0, 1e3, 10e3, 100e3, 1e6, rf_frequency_hz})
    points = []
    for frequency in frequency_hz:
        susceptance_s = 2.0 * math.pi * frequency * max(0.0, capacitance_pf) * 1e-12
        magnitude_s = math.hypot(conductance_s, susceptance_s)
        phase_deg = math.degrees(math.atan2(susceptance_s, conductance_s)) if magnitude_s > 0.0 else 0.0
        points.append(
            {
                "frequency_hz": frequency,
                "conductance_s": conductance_s,
                "susceptance_s": susceptance_s,
                "magnitude_s": magnitude_s,
                "phase_deg": phase_deg,
                "impedance_ohm": (1.0 / magnitude_s) if magnitude_s > 0.0 else None,
            }
        )
    return {
        "method": "load-plus-capacitance",
        "capacitance_pf": capacitance_pf,
        "load_current_na": max(0.0, float(p.get("load_current_na", 1.0))),
        "load_resistance_ohm": load_resistance_ohm,
        "rf_frequency_hz": rf_frequency_hz,
        "frequency_points": points,
        "formula": "Y(f) = I_load / V_bias + j 2*pi*f*C",
    }


def _colliding_cell_lookup(mesh: Any, points: Any, modules: dict[str, Any]) -> list[int | None]:
    geometry = modules["geometry"]
    tdim = mesh.topology.dim
    try:
        tree = geometry.bb_tree(mesh, tdim)
    except AttributeError:
        tree = geometry.BoundingBoxTree(mesh, tdim)

    try:
        candidates = geometry.compute_collisions_points(tree, points)
    except AttributeError:
        candidates = geometry.compute_collisions(tree, points)
    colliding = geometry.compute_colliding_cells(mesh, candidates, points)

    cells: list[int | None] = []
    for index in range(len(points)):
        links = colliding.links(index)
        cells.append(int(links[0]) if len(links) else None)
    return cells


def _eval_function_at_points(fn: Any, mesh: Any, rz_points: list[tuple[float, float]], modules: dict[str, Any]) -> list[float | None]:
    np = modules["np"]
    if not rz_points:
        return []
    points = np.zeros((len(rz_points), 3), dtype=np.float64)
    for index, (r, z) in enumerate(rz_points):
        points[index, 0] = r
        points[index, 1] = z
    cells = _colliding_cell_lookup(mesh, points, modules)
    values: list[float | None] = []
    for point, cell in zip(points, cells):
        if cell is None:
            values.append(None)
            continue
        try:
            value = fn.eval(point, cell)
        except TypeError:
            value = fn.eval(point.reshape(1, -1), [cell])
        values.append(float(value[0] if hasattr(value, "__len__") else value))
    return values


def _sample_to_browser_grid(
    mesh: Any,
    field_fn: Any,
    p: dict[str, Any],
    modules: dict[str, Any],
    mesh_sizes: dict[str, float] | None = None,
) -> dict[str, Any]:
    grid = axisymmetric_model.build_grid(p)
    r_coords = grid["r_coords"]
    z_coords = grid["z_coords"]
    labels = grid["labels"]
    materials = grid["materials"]
    nr = grid["nr"]
    nz = grid["nz"]
    length = axisymmetric_model.stack_length_mm(p)

    sample_points: list[tuple[int, int, float, float]] = []
    for i, r in enumerate(r_coords):
        for j, z in enumerate(z_coords):
            if labels[i][j] != "dielectric":
                continue
            if z < 0.0 or z > length:
                continue
            sample_points.append((i, j, r, z))

    values = _eval_function_at_points(field_fn, mesh, [(r, z) for _, _, r, z in sample_points], modules)
    field = [[0.0 for _ in range(nz)] for _ in range(nr)]
    raw_max_field = 0.0
    raw_max_location = (0.0, 0.0)
    raw_dielectric_peaks = {
        "washer": {"key": "washer", "maxField": 0.0, "maxLocation": {"r": 0.0, "z": 0.0}},
        "epoxy": {"key": "epoxy", "maxField": 0.0, "maxLocation": {"r": 0.0, "z": 0.0}},
    }

    for (i, j, r, z), value in zip(sample_points, values):
        if value is None or not math.isfinite(value):
            continue
        field[i][j] = value
        if value > raw_max_field:
            raw_max_field = value
            raw_max_location = (r, z)
        material = materials[i][j]
        peak = raw_dielectric_peaks.get(material)
        if peak is not None and value > peak["maxField"]:
            peak["maxField"] = value
            peak["maxLocation"] = {"r": r, "z": z}
    supported = axisymmetric_model.supported_field_metrics(
        grid,
        field,
        raw_max_field,
        raw_max_location,
        raw_dielectric_peaks,
    )

    grid["mesh"] = {
        **grid.get("mesh", {}),
        "type": "gmsh-dolfinx-conforming",
        "sampled_grid": "axisymmetric_model.build_grid",
        "finite_element_family": "Lagrange P1",
        "field_projection": "DG0 |grad(V)| sampled to r-z grid",
        "target_fine_mm": mesh_sizes.get("fine") if mesh_sizes else None,
        "target_coarse_mm": mesh_sizes.get("coarse") if mesh_sizes else None,
        "edge_radius_ratio": mesh_sizes.get("edge_radius_ratio") if mesh_sizes else None,
        "edge_radius_mm": mesh_sizes.get("edge_radius_mm") if mesh_sizes else None,
        "gap_limiter_mm": mesh_sizes.get("gap_limiter_mm") if mesh_sizes else None,
    }
    return {
        "grid": grid,
        "field": field,
        "max_field_v_per_mm": supported["max_field_v_per_mm"],
        "max_field_kv_per_mm": supported["max_field_v_per_mm"] / 1000.0,
        "max_location_mm": supported["max_location_mm"],
        "raw_max_field_v_per_mm": raw_max_field,
        "raw_max_field_kv_per_mm": raw_max_field / 1000.0,
        "raw_max_location_mm": {"r": raw_max_location[0], "z": raw_max_location[1]},
        "dielectric_peaks": supported["dielectric_peaks"],
        "raw_dielectric_peaks": raw_dielectric_peaks,
        "peak_quality": supported["peak_quality"],
    }


def solve(parameters: dict[str, Any]) -> dict[str, Any]:
    """Run the conforming axisymmetric FEniCSx/Gmsh electrostatic solve."""
    p = axisymmetric_model.normalize_parameters(dict(parameters))
    modules = _import_fenicsx_modules()
    gmsh = modules["gmsh"]
    mesh_sizes: dict[str, float] | None = None
    try:
        mesh_sizes = _build_gmsh_model(p, modules)
        mesh = _model_to_mesh(modules)
    finally:
        gmsh.finalize()

    uh = _solve_potential(mesh, p, modules)
    capacitance = _capacitance_from_energy(mesh, uh, p, modules)
    parasitic_capacitance = _representative_adjacent_bias_parasitic_capacitance(p, modules)
    if parasitic_capacitance:
        capacitance.update({
            key: value
            for key, value in parasitic_capacitance.items()
            if key in {
                "parasitic_pf",
                "adjacent_bias_pf",
                "bias_to_bias_pf",
                "raw_adjacent_bias_pf",
            }
        })
        capacitance["parasitic_estimate"] = parasitic_capacitance
    admittance = _admittance_from_capacitance(p, capacitance["total_pf"])
    field_fn = _project_field_magnitude(mesh, uh, modules)
    sampled = _sample_to_browser_grid(mesh, field_fn, p, modules, mesh_sizes)
    return {
        "parameters": p,
        "grid": sampled["grid"],
        "iterations_run": 1,
        "last_delta_v": 0.0,
        "max_field_v_per_mm": sampled["max_field_v_per_mm"],
        "max_field_kv_per_mm": sampled["max_field_kv_per_mm"],
        "max_location_mm": sampled["max_location_mm"],
        "raw_max_field_v_per_mm": sampled["raw_max_field_v_per_mm"],
        "raw_max_field_kv_per_mm": sampled["raw_max_field_kv_per_mm"],
        "raw_max_location_mm": sampled["raw_max_location_mm"],
        "dielectric_peaks": sampled["dielectric_peaks"],
        "raw_dielectric_peaks": sampled["raw_dielectric_peaks"],
        "peak_quality": sampled["peak_quality"],
        "capacitance": capacitance,
        "admittance": admittance,
        "field": sampled["field"],
        "adaptive": {
            "enabled": True,
            "type": "gmsh-conforming-fea",
            "note": "Initial conforming FEniCSx/Gmsh solve sampled onto the browser r-z grid.",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect optional FEniCSx backend readiness.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable status.")
    parser.add_argument("--solve-stdin", action="store_true", help="Read parameters as JSON from stdin and print the solve result as JSON.")
    args = parser.parse_args()
    if args.solve_stdin:
        import sys

        parameters = json.load(sys.stdin)
        print(json.dumps(solve(parameters)))
        return
    status = dependency_status()
    if args.json:
        print(json.dumps(status, indent=2))
        return
    print(f"FEniCSx modules available: {status['available']}")
    print(f"Filter solver implemented: {status['implemented']}")
    if status["missing"]:
        print(f"Missing modules: {', '.join(status['missing'])}")
        print(f"Install hint: {status['installHint']}")
    else:
        print("All dependency modules were found.")


if __name__ == "__main__":
    main()
