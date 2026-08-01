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
import bisect
import importlib.metadata
import importlib.util
import json
import math
import subprocess
import sys
import time
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
SOLVE_STRATEGY_MIRROR_HALF = "mirror_half"
SOLVE_STRATEGY_END_REPEAT_APPROX = "end_repeat_approx"
CAPACITANCE_STRATEGY_FULL = "full_excitations"
CAPACITANCE_STRATEGY_MIRROR = "mirror_excitations"
CAPACITANCE_STRATEGY_REPEAT = "repeat_interior"


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


def _component_profile_for_solve(
    p: dict[str, Any],
    component: dict[str, Any],
    include_core_dielectric: bool,
) -> list[tuple[float, float]]:
    """Return the conductor profile used by the selected electrostatic model."""
    profile = [(float(r), float(z)) for r, z in component["profile"]]
    if not (
        include_core_dielectric
        and component["material"] == "hv"
        and component["name"].startswith("hv_plate_")
    ):
        return profile

    # The capacitance model keeps each inter-plate core segment dielectric, but
    # each bias node must contact the full core cross-section. Current geometry
    # profiles already use solid bias discs; snapping any legacy inner points
    # to the axis keeps imported/older profiles consistent with that topology.
    core_r = float(p["core_od_mm"]) / 2.0
    return [
        (0.0 if r <= core_r + GEOMETRY_TOLERANCE_MM else r, z)
        for r, z in profile
    ]


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


def _build_gmsh_model(
    p: dict[str, Any],
    modules: dict[str, Any],
    include_core_dielectric: bool = False,
    z_min_mm: float = 0.0,
    z_max_mm: float | None = None,
) -> dict[str, float]:
    gmsh = modules["gmsh"]
    sizes = _mesh_sizes(p)
    length = axisymmetric_model.stack_length_mm(p)
    solve_z_min = max(0.0, min(float(z_min_mm), length))
    solve_z_max = length if z_max_mm is None else max(solve_z_min, min(float(z_max_mm), length))
    core_r = p["core_od_mm"] / 2.0
    tube_inner = p["tube_id_mm"] / 2.0
    r_min = 0.0 if include_core_dielectric else core_r

    gmsh.initialize()
    gmsh.model.add("discoidal_capacitor_bias_filter_axisymmetric")
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.option.setNumber("Mesh.CharacteristicLengthMin", sizes["fine"])
    gmsh.option.setNumber("Mesh.CharacteristicLengthMax", sizes["coarse"])
    gmsh.option.setNumber("Mesh.Algorithm", 6)

    domain = gmsh.model.occ.addRectangle(r_min, solve_z_min, 0.0, tube_inner - r_min, solve_z_max - solve_z_min)
    tools: list[tuple[int, int]] = []
    for component in axisymmetric_model.component_profiles(p):
        if component["material"] not in {"hv", "ground"}:
            continue
        solve_profile = _component_profile_for_solve(p, component, include_core_dielectric)
        profile = [
            (min(max(float(r), r_min), tube_inner), min(max(float(z), solve_z_min), solve_z_max))
            for r, z in solve_profile
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
    include_core_dielectric: bool = False,
) -> Any:
    np = modules["np"]
    length = axisymmetric_model.stack_length_mm(p)
    components = [
        {
            **component,
            "profile": _component_profile_for_solve(p, component, include_core_dielectric),
        }
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


def _grounded_outer_axial_cut_marker(
    p: dict[str, Any],
    z_cut_mm: float,
    modules: dict[str, Any],
) -> Any:
    """Ground the non-electrode annulus on a truncated neighbor-bias plane."""
    np = modules["np"]
    bias_outer = float(p["hv_plate_od_mm"]) / 2.0

    def marker(x: Any) -> Any:
        return np.logical_and(
            np.abs(x[1] - float(z_cut_mm)) <= BOUNDARY_MARKER_TOLERANCE_MM,
            x[0] >= bias_outer - BOUNDARY_MARKER_TOLERANCE_MM,
        )

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
    energy_scale: float = 1.0,
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
    energy_pj = _assemble_global_scalar(mesh, energy_integrand, modules) * float(energy_scale)
    capacitance_pf = 2.0 * energy_pj / (voltage * voltage) if voltage > 0.0 else 0.0
    return {
        "total_pf": capacitance_pf,
        "bias_to_ground_pf": capacitance_pf,
        "energy_pj": energy_pj,
        "voltage_v": voltage,
        "method": "fenicsx-energy",
        "description": "C = 2U/V^2 from the axisymmetric dielectric energy integral.",
    }


def _maxwell_cross_capacitance_pf(
    mesh: Any,
    potential_i: Any,
    potential_j: Any,
    p: dict[str, Any],
    modules: dict[str, Any],
) -> float:
    """Assemble one Maxwell capacitance coefficient from two basis fields."""
    ufl = modules["ufl"]
    x = ufl.SpatialCoordinate(mesh)
    epsr = _dielectric_epsr_expression(
        mesh,
        p,
        modules,
        include_core_dielectric=True,
    )
    integrand = (
        2.0
        * math.pi
        * x[0]
        * EPSILON_0_PF_PER_MM
        * epsr
        * ufl.inner(ufl.grad(potential_i), ufl.grad(potential_j))
        * ufl.dx
    )
    return _assemble_global_scalar(mesh, integrand, modules)


def _reflect_potential_axially(
    mesh: Any,
    potential: Any,
    z_min_mm: float,
    z_max_mm: float,
    modules: dict[str, Any],
) -> Any:
    """Interpolate an exact axial reflection of a scalar basis field."""
    fem = modules["fem"]
    np = modules["np"]
    function_space = potential.function_space
    dof_coordinates = function_space.tabulate_dof_coordinates()
    reflected_points = np.zeros((len(dof_coordinates), 3), dtype=np.float64)
    reflected_points[:, : dof_coordinates.shape[1]] = dof_coordinates
    reflected_points[:, 1] = float(z_min_mm) + float(z_max_mm) - dof_coordinates[:, 1]
    cells = _colliding_cell_lookup(mesh, reflected_points, modules)
    for index, cell in enumerate(cells):
        if cell is not None:
            continue
        original = reflected_points[index].copy()
        located = False
        for distance in (1e-8, 1e-7, 1e-6):
            offsets = [
                (0.0, distance),
                (0.0, -distance),
                (distance, 0.0),
                (-distance, 0.0),
                (distance, distance),
                (distance, -distance),
                (-distance, distance),
                (-distance, -distance),
            ]
            candidates = np.repeat(original.reshape(1, 3), len(offsets), axis=0)
            for candidate, (dr, dz) in zip(candidates, offsets):
                candidate[0] = max(0.0, candidate[0] + dr)
                candidate[1] += dz
            candidate_cells = _colliding_cell_lookup(mesh, candidates, modules)
            match = next(
                (
                    (candidate, candidate_cell)
                    for candidate, candidate_cell in zip(candidates, candidate_cells)
                    if candidate_cell is not None
                ),
                None,
            )
            if match is not None:
                reflected_points[index] = match[0]
                cells[index] = match[1]
                located = True
                break
        if not located:
            raise RuntimeError(
                "Could not locate reflected capacitance DOF at "
                f"r={original[0]:.9g}, z={original[1]:.9g} mm"
            )
    cell_indices = np.asarray(cells, dtype=np.int32)
    values = potential.eval(reflected_points, cell_indices)
    reflected = fem.Function(function_space)
    reflected.x.array[:] = np.asarray(values).reshape(-1)
    reflected.x.scatter_forward()
    return reflected


def _adjacent_pair_capacitance_from_energies(
    middle_only_pf: float,
    neighbors_only_pf: float,
    all_bias_pf: float,
    neighbor_count: int,
) -> float:
    """Extract average middle-to-neighbor mutual C using energy polarization."""
    if neighbor_count <= 0:
        raise ValueError("neighbor_count must be positive")
    return (middle_only_pf + neighbors_only_pf - all_bias_pf) / (2.0 * neighbor_count)


def _middle_ground_capacitance_from_energies(
    middle_only_pf: float,
    neighbors_only_pf: float,
    all_bias_pf: float,
) -> float:
    """Remove middle-to-neighbor mutual capacitance from a three-node solve.

    The middle-only equivalent is its ground capacitance plus every mutual
    capacitor to the grounded neighboring bias plates. Combining the same
    three energy states used for Cpar cancels those mutual terms exactly.
    """
    return (middle_only_pf - neighbors_only_pf + all_bias_pf) / 2.0


def _capacitance_network_from_energy_equivalents(
    node_names: list[str],
    single_node_pf: list[float],
    pair_node_pf: dict[tuple[int, int], float],
    all_bias_pf: float,
) -> dict[str, Any]:
    """Recover a physical capacitor network from electrostatic energy solves.

    A one-volt excitation of node i returns the Maxwell diagonal Cii. Driving
    nodes i and j together returns Cii + Cjj + 2 Cij, where the Maxwell
    off-diagonal Cij is negative. The physical mutual capacitor is therefore
    (Cii + Cjj - Cij,together) / 2. The node-to-ground capacitance is the
    Maxwell row sum after subtracting every mutual capacitor.
    """
    count = len(node_names)
    if count == 0 or len(single_node_pf) != count:
        raise ValueError("node_names and single_node_pf must have the same nonzero length")

    mutual_pf = [[0.0 for _ in range(count)] for _ in range(count)]
    raw_mutual_pf = [[0.0 for _ in range(count)] for _ in range(count)]
    for i in range(count):
        for j in range(i + 1, count):
            together = float(pair_node_pf[(i, j)])
            raw = (float(single_node_pf[i]) + float(single_node_pf[j]) - together) / 2.0
            raw_mutual_pf[i][j] = raw_mutual_pf[j][i] = raw
            mutual_pf[i][j] = mutual_pf[j][i] = max(0.0, raw)

    raw_ground_pf = [
        float(single_node_pf[i]) - sum(mutual_pf[i][j] for j in range(count) if j != i)
        for i in range(count)
    ]
    nonnegative_ground_pf = [max(0.0, value) for value in raw_ground_pf]
    ground_sum = sum(nonnegative_ground_pf)
    ground_scale = float(all_bias_pf) / ground_sum if ground_sum > 0.0 else 1.0
    ground_pf = [value * ground_scale for value in nonnegative_ground_pf]

    maxwell_pf = [[0.0 for _ in range(count)] for _ in range(count)]
    for i in range(count):
        maxwell_pf[i][i] = ground_pf[i] + sum(mutual_pf[i])
        for j in range(count):
            if i != j:
                maxwell_pf[i][j] = -mutual_pf[i][j]

    adjacent_pf = [mutual_pf[i][i + 1] for i in range(count - 1)]
    return {
        "method": "fenicsx-full-capacitance-matrix-energy-polarization",
        "node_count": count,
        "node_names": node_names,
        "node_ground_pf": ground_pf,
        "raw_node_ground_pf": raw_ground_pf,
        "mutual_pf_matrix": mutual_pf,
        "raw_mutual_pf_matrix": raw_mutual_pf,
        "maxwell_pf_matrix": maxwell_pf,
        "single_node_equivalent_pf": [float(value) for value in single_node_pf],
        "pair_node_equivalent_pf": {
            f"{i},{j}": float(value)
            for (i, j), value in pair_node_pf.items()
        },
        "adjacent_mutual_pf": adjacent_pf,
        "average_adjacent_mutual_pf": (
            sum(adjacent_pf) / len(adjacent_pf) if adjacent_pf else 0.0
        ),
        "all_bias_equivalent_pf": float(all_bias_pf),
        "total_ground_pf": sum(ground_pf),
        "ground_normalization_factor": ground_scale,
        "energy_solve_count": count + count * (count - 1) // 2 + 1,
        "core_treatment": "dielectric-with-effective-permittivity",
        "electrode_treatment": "solid-bias-plate-cross-sections",
        "exact_full_stack": True,
    }


def _capacitance_excitation_representatives(
    node_count: int,
    use_repeating_interior: bool,
) -> tuple[list[int], dict[tuple[int, int], tuple[int, int]]]:
    """Map capacitance excitations onto mirror/repeating symmetry classes."""
    if node_count <= 0:
        raise ValueError("node_count must be positive")

    # Cpar is a small difference of excitation energies. Even in repeating
    # mode, retain each exact mirror class for Cii so a center-node self term
    # is never substituted into a near-end pair polarization.
    single_representatives = [
        min(index, node_count - 1 - index)
        for index in range(node_count)
    ]

    pair_representatives: dict[tuple[int, int], tuple[int, int]] = {}
    for i in range(node_count):
        for j in range(i + 1, node_count):
            if use_repeating_interior:
                if i == 0 or j == node_count - 1:
                    # Preserve end-region coupling; only its exact reflected
                    # counterpart is equivalent.
                    reflected = (node_count - 1 - j, node_count - 1 - i)
                    representative = min((i, j), reflected)
                else:
                    # Fully interior mutual capacitance is repeated by axial
                    # separation. Choose the most central available pair.
                    separation = j - i
                    candidates = [
                        (start, start + separation)
                        for start in range(1, node_count - separation - 1)
                    ]
                    representative = min(
                        candidates,
                        key=lambda pair: (
                            abs((pair[0] + pair[1]) - (node_count - 1)),
                            pair[0],
                        ),
                    )
            else:
                reflected = (node_count - 1 - j, node_count - 1 - i)
                representative = min((i, j), reflected)
            pair_representatives[(i, j)] = representative

    return single_representatives, pair_representatives


def _repeating_ground_capacitance_representatives(node_count: int) -> list[int]:
    """Return the end/interior Cg classes assumed by the repeating model."""
    if node_count <= 0:
        raise ValueError("node_count must be positive")
    interior_representative = max(0, (node_count - 1) // 2)
    return [
        0 if index in {0, node_count - 1} else interior_representative
        for index in range(node_count)
    ]


def _apply_ground_capacitance_classes(
    network: dict[str, Any],
    representatives: list[int],
) -> None:
    """Copy representative Cg values and retain the all-bias total."""
    original_raw = [float(value) for value in network["raw_node_ground_pf"]]
    if len(original_raw) != len(representatives):
        raise ValueError("ground-capacitance representatives must match node count")

    class_raw = [original_raw[representative] for representative in representatives]
    nonnegative = [max(0.0, value) for value in class_raw]
    total = float(network["all_bias_equivalent_pf"])
    scale = total / sum(nonnegative) if sum(nonnegative) > 0.0 else 1.0
    ground_pf = [value * scale for value in nonnegative]
    mutual_pf = network["mutual_pf_matrix"]
    count = len(ground_pf)
    maxwell_pf = [[0.0 for _ in range(count)] for _ in range(count)]
    for i in range(count):
        maxwell_pf[i][i] = ground_pf[i] + sum(float(value) for value in mutual_pf[i])
        for j in range(count):
            if i != j:
                maxwell_pf[i][j] = -float(mutual_pf[i][j])

    network["unconstrained_raw_node_ground_pf"] = original_raw
    network["raw_node_ground_pf"] = class_raw
    network["node_ground_pf"] = ground_pf
    network["maxwell_pf_matrix"] = maxwell_pf
    network["total_ground_pf"] = sum(ground_pf)
    network["ground_normalization_factor"] = scale


def _repeating_capacitance_network(
    p: dict[str, Any],
    end_region_pf: float,
    interior_half_cell_pf: float,
) -> dict[str, Any]:
    """Build a constant-cost screening network from the all-bias FEA regions.

    ``end_region_pf`` and ``interior_half_cell_pf`` are the capacitances
    corresponding to one physical end region and one repeating interior
    half-cell. Because those solves drive every bias plate together, they
    determine total all-bias capacitance but not individual Maxwell rows.
    Regional energy is allocated to end/interior nodes only as a screening
    equivalent. The adjacent mutual term likewise cannot be separated from an
    all-bias field solve, so use the local parallel-plate screen rather than
    applying invalid symmetry to asymmetric basis excitations.
    """
    local_p = axisymmetric_model.normalize_parameters(dict(p))
    count = int(local_p["plate_pairs"])
    node_names = [f"hv_plate_{index}" for index in range(count)]
    end_pf = max(0.0, float(end_region_pf))
    half_cell_pf = max(0.0, float(interior_half_cell_pf))
    if count == 1:
        ground_pf = [2.0 * end_pf]
    else:
        ground_pf = [end_pf + half_cell_pf]
        ground_pf.extend([2.0 * half_cell_pf] * max(0, count - 2))
        ground_pf.append(end_pf + half_cell_pf)

    total_ground_pf = sum(ground_pf)
    adjacent_mutual_pf = (
        max(0.0, _analytic_parallel_plate_cpar_pf(local_p))
        if count > 1
        else 0.0
    )
    mutual_pf = [[0.0 for _ in range(count)] for _ in range(count)]
    for index in range(count - 1):
        mutual_pf[index][index + 1] = adjacent_mutual_pf
        mutual_pf[index + 1][index] = adjacent_mutual_pf

    maxwell_pf = [[0.0 for _ in range(count)] for _ in range(count)]
    for i in range(count):
        maxwell_pf[i][i] = ground_pf[i] + sum(mutual_pf[i])
        for j in range(count):
            if i != j:
                maxwell_pf[i][j] = -mutual_pf[i][j]

    pair_node_pf = {
        f"{i},{j}": maxwell_pf[i][i] + maxwell_pf[j][j] - 2.0 * mutual_pf[i][j]
        for i in range(count)
        for j in range(i + 1, count)
    }
    return {
        "method": "fenicsx-end-repeat-screening-equivalent-network",
        "node_count": count,
        "node_names": node_names,
        "node_ground_pf": ground_pf,
        "raw_node_ground_pf": ground_pf[:],
        "mutual_pf_matrix": mutual_pf,
        "raw_mutual_pf_matrix": [row[:] for row in mutual_pf],
        "maxwell_pf_matrix": maxwell_pf,
        "raw_maxwell_pf_matrix": [row[:] for row in maxwell_pf],
        "single_node_equivalent_pf": [maxwell_pf[i][i] for i in range(count)],
        "pair_node_equivalent_pf": pair_node_pf,
        "adjacent_mutual_pf": [adjacent_mutual_pf] * max(0, count - 1),
        "average_adjacent_mutual_pf": adjacent_mutual_pf,
        "all_bias_equivalent_pf": total_ground_pf,
        "total_ground_pf": total_ground_pf,
        "ground_normalization_factor": 1.0,
        "core_treatment": "dielectric-with-effective-permittivity",
        "electrode_treatment": "solid-bias-plate-cross-sections",
        "energy_solve_count_without_symmetry": count + 1,
        "energy_solve_count": 2,
        "energy_solves_saved": max(0, count - 1),
        "all_bias_solve_reused": True,
        "symmetry_strategy": "two-region-end-and-repeating-interior-reconstruction",
        "geometry_domain": "one-end-region-plus-one-interior-half-cell",
        "geometric_mirror_half_used": False,
        "mirror_equivalent_excitations_reused": True,
        "matrix_extraction": "not performed; screening allocation from symmetric all-bias energy",
        "excitation_strategy": CAPACITANCE_STRATEGY_REPEAT,
        "repeating_interior_approximation": True,
        "single_excitation_representatives": [0 if i in {0, count - 1} else 1 for i in range(count)],
        "ground_capacitance_representatives": [0 if i in {0, count - 1} else 1 for i in range(count)],
        "pair_excitation_representatives": {
            f"{i},{j}": ("adjacent-interior" if j == i + 1 else "neglected-nonadjacent")
            for i in range(count)
            for j in range(i + 1, count)
        },
        "parasitic_method": "analytic-core-plus-epoxy-adjacent-parallel-plate-screen",
        "node_ground_values_are_maxwell_row_sums": False,
        "mutual_values_are_fea_extracted": False,
        "capacitance_validity": {
            "all_bias_total": {
                "source": "two-region-fenicsx-all-bias-energy",
                "excitation_is_reflection_symmetric": True,
                "repeating_interior_is_finite_stack_approximation": True,
            },
            "node_ground_values": {
                "source": "end-and-interior-regional-energy-allocation",
                "basis_fields_solved": False,
                "maxwell_row_sums": False,
                "purpose": "fast-spice-screening-only",
            },
            "mutual_values": {
                "source": "analytic-local-parallel-plate-screen",
                "basis_fields_solved": False,
                "fea_extracted": False,
                "nonadjacent_terms": "neglected",
            },
        },
        "exact_full_stack": False,
    }


def _full_capacitance_network(
    p: dict[str, Any],
    modules: dict[str, Any],
    excitation_strategy: str | None = None,
) -> dict[str, Any]:
    """Extract node-to-ground and all bias-to-bias capacitances on one mesh."""
    local_p = axisymmetric_model.normalize_parameters({
        **p,
        "bias_voltage_v": 1.0,
        "solve_strategy": "full_stack",
    })
    gmsh = modules["gmsh"]
    try:
        mesh_sizes = _build_gmsh_model(
            local_p,
            modules,
            include_core_dielectric=True,
        )
        mesh = _model_to_mesh(modules)
    finally:
        gmsh.finalize()

    hv_components = [
        component
        for component in axisymmetric_model.component_profiles(local_p)
        if component["material"] == "hv" and component["name"].startswith("hv_plate_")
    ]
    hv_components.sort(
        key=lambda component: sum(float(point[1]) for point in component["profile"])
        / max(1, len(component["profile"]))
    )
    node_names = [component["name"] for component in hv_components]
    if not node_names:
        raise RuntimeError("FEniCSx capacitance extraction found no bias-plate electrodes")

    all_names = set(node_names)
    ground_marker = _component_marker(
        local_p,
        modules,
        materials={"ground"},
        include_core_dielectric=True,
    )

    def solve_basis_potential(active_names: set[str]) -> Any:
        inactive_names = all_names - active_names
        markers: list[tuple[float, Any]] = [
            (
                1.0,
                _component_marker(
                    local_p,
                    modules,
                    names=active_names,
                    include_core_dielectric=True,
                ),
            ),
        ]
        if inactive_names:
            markers.append(
                (
                    0.0,
                    _component_marker(
                        local_p,
                        modules,
                        names=inactive_names,
                        include_core_dielectric=True,
                    ),
                )
            )
        markers.append((0.0, ground_marker))
        return _solve_potential_with_dirichlet_markers(
            mesh,
            local_p,
            modules,
            markers,
            include_core_dielectric=True,
        )

    if excitation_strategy is None:
        excitation_strategy = (
            CAPACITANCE_STRATEGY_REPEAT
            if (
                p.get("solve_strategy") == SOLVE_STRATEGY_END_REPEAT_APPROX
                or bool(p.get("use_repeating_cell_approximation", False))
            )
            else CAPACITANCE_STRATEGY_MIRROR
        )
    if excitation_strategy not in {
        CAPACITANCE_STRATEGY_FULL,
        CAPACITANCE_STRATEGY_MIRROR,
        CAPACITANCE_STRATEGY_REPEAT,
    }:
        raise ValueError(f"Unsupported capacitance excitation strategy: {excitation_strategy}")

    use_repeating_interior = excitation_strategy == CAPACITANCE_STRATEGY_REPEAT
    count = len(node_names)
    reuse_small_mirror = (
        excitation_strategy != CAPACITANCE_STRATEGY_FULL
        and count in {2, 3}
    )
    if reuse_small_mirror:
        basis_indices = [0] if count == 2 else [0, 1]
        single_representatives = [0, 0] if count == 2 else [0, 1, 0]
    else:
        basis_indices = list(range(count))
        single_representatives = list(range(count))
    basis_potentials = {
        index: solve_basis_potential({node_names[index]})
        for index in basis_indices
    }
    if reuse_small_mirror:
        stack_length = axisymmetric_model.stack_length_mm(local_p)
        for index in range(count):
            if index in basis_potentials:
                continue
            representative = single_representatives[index]
            basis_potentials[index] = _reflect_potential_axially(
                mesh,
                basis_potentials[representative],
                0.0,
                stack_length,
                modules,
            )

    raw_maxwell_pf = [[0.0 for _ in range(count)] for _ in range(count)]
    for i in range(count):
        for j in range(i, count):
            coefficient = _maxwell_cross_capacitance_pf(
                mesh,
                basis_potentials[i],
                basis_potentials[j],
                local_p,
                modules,
            )
            raw_maxwell_pf[i][j] = coefficient
            raw_maxwell_pf[j][i] = coefficient

    all_bias_solve_reused = count == 1
    if all_bias_solve_reused:
        all_bias_pf = float(raw_maxwell_pf[0][0])
    else:
        all_bias_potential = solve_basis_potential(all_names)
        all_bias_pf = _capacitance_from_energy(
            mesh,
            all_bias_potential,
            local_p,
            modules,
            voltage_v=1.0,
            include_core_dielectric=True,
        )["total_pf"]

    maxwell_pf = [row[:] for row in raw_maxwell_pf]
    if excitation_strategy != CAPACITANCE_STRATEGY_FULL:
        maxwell_pf = [
            [
                (
                    raw_maxwell_pf[i][j]
                    + raw_maxwell_pf[count - 1 - i][count - 1 - j]
                ) / 2.0
                for j in range(count)
            ]
            for i in range(count)
        ]

    pair_representatives = {
        (i, j): (i, j)
        for i in range(count)
        for j in range(i + 1, count)
    }
    mutual_pf = [[0.0 for _ in range(count)] for _ in range(count)]
    for i in range(count):
        for j in range(i + 1, count):
            value = max(0.0, -float(maxwell_pf[i][j]))
            mutual_pf[i][j] = mutual_pf[j][i] = value

    if use_repeating_interior:
        _, pair_representatives = _capacitance_excitation_representatives(
            count,
            use_repeating_interior=True,
        )
        values_by_representative: dict[tuple[int, int], list[float]] = {}
        for pair, representative in pair_representatives.items():
            values_by_representative.setdefault(representative, []).append(
                mutual_pf[pair[0]][pair[1]]
            )
        representative_values = {
            representative: sum(values) / len(values)
            for representative, values in values_by_representative.items()
        }
        for (i, j), representative in pair_representatives.items():
            value = representative_values[representative]
            mutual_pf[i][j] = mutual_pf[j][i] = value

    raw_ground_pf = [
        float(maxwell_pf[i][i]) - sum(mutual_pf[i])
        for i in range(count)
    ]
    adjacent_pf = [mutual_pf[i][i + 1] for i in range(count - 1)]
    pair_node_pf = {
        (i, j): float(maxwell_pf[i][i]) + float(maxwell_pf[j][j]) - 2.0 * mutual_pf[i][j]
        for i in range(count)
        for j in range(i + 1, count)
    }
    network = {
        "method": "fenicsx-maxwell-matrix-basis-cross-energy",
        "node_count": count,
        "node_names": node_names,
        "node_ground_pf": [max(0.0, value) for value in raw_ground_pf],
        "raw_node_ground_pf": raw_ground_pf,
        "mutual_pf_matrix": mutual_pf,
        "raw_mutual_pf_matrix": [
            [
                0.0 if i == j else -float(maxwell_pf[i][j])
                for j in range(count)
            ]
            for i in range(count)
        ],
        "maxwell_pf_matrix": maxwell_pf,
        "raw_maxwell_pf_matrix": raw_maxwell_pf,
        "single_node_equivalent_pf": [
            float(maxwell_pf[i][i]) for i in range(count)
        ],
        "pair_node_equivalent_pf": {
            f"{i},{j}": value for (i, j), value in pair_node_pf.items()
        },
        "adjacent_mutual_pf": adjacent_pf,
        "average_adjacent_mutual_pf": (
            sum(adjacent_pf) / len(adjacent_pf) if adjacent_pf else 0.0
        ),
        "all_bias_equivalent_pf": float(all_bias_pf),
        "total_ground_pf": sum(max(0.0, value) for value in raw_ground_pf),
        "ground_normalization_factor": 1.0,
        "core_treatment": "dielectric-with-effective-permittivity",
        "electrode_treatment": "solid-bias-plate-cross-sections",
    }
    if use_repeating_interior:
        ground_representatives = _repeating_ground_capacitance_representatives(count)
    elif excitation_strategy == CAPACITANCE_STRATEGY_MIRROR:
        ground_representatives = [
            min(index, count - 1 - index)
            for index in range(count)
        ]
    else:
        ground_representatives = list(range(count))
    _apply_ground_capacitance_classes(network, ground_representatives)
    single_node_pf = [float(value) for value in network["single_node_equivalent_pf"]]
    full_solve_count = count + 1
    actual_solve_count = len(basis_indices) + (0 if all_bias_solve_reused else 1)
    network.update({
        "energy_solve_count_without_symmetry": full_solve_count,
        "energy_solve_count": actual_solve_count,
        "energy_solves_saved": full_solve_count - actual_solve_count,
        "all_bias_solve_reused": all_bias_solve_reused,
        "symmetry_strategy": (
            "full-domain-maxwell-matrix-mirror-and-repeating-constraints"
            if use_repeating_interior
            else "full-domain-maxwell-matrix-exact-mirror-averaging"
            if excitation_strategy == CAPACITANCE_STRATEGY_MIRROR
            else "full-domain-maxwell-matrix-no-symmetry"
        ),
        "geometry_domain": "full-stack",
        "geometric_mirror_half_used": False,
        "mirror_equivalent_excitations_reused": reuse_small_mirror,
        "matrix_extraction": (
            "basis-field cross-energy with exact reflected-field interpolation"
            if reuse_small_mirror
            else "basis-field cross-energy"
        ),
        "excitation_strategy": excitation_strategy,
        "repeating_interior_approximation": use_repeating_interior,
        "single_excitation_representatives": single_representatives,
        "ground_capacitance_representatives": ground_representatives,
        "pair_excitation_representatives": {
            f"{i},{j}": f"{representative[0]},{representative[1]}"
            for (i, j), representative in pair_representatives.items()
        },
        "exact_full_stack": not use_repeating_interior,
        "node_ground_values_are_maxwell_row_sums": True,
        "mutual_values_are_fea_extracted": True,
        "capacitance_validity": {
            "all_bias_total": {
                "source": "full-stack-fenicsx-all-bias-energy",
                "excitation_is_reflection_symmetric": True,
            },
            "node_ground_values": {
                "source": "full-stack-basis-cross-energy-maxwell-row-sums",
                "basis_fields_solved": True,
                "maxwell_row_sums": True,
                "reflection_reuse": (
                    "exact-reflected-partner-excitation"
                    if reuse_small_mirror
                    else "none; reflected coefficients averaged after full-stack solves"
                ),
            },
            "mutual_values": {
                "source": "full-stack-basis-cross-energy",
                "basis_fields_solved": True,
                "fea_extracted": True,
            },
        },
    })
    if len(node_names) >= 2:
        pair_i = max(0, (len(node_names) - 1) // 2)
        pair_j = pair_i + 1
        representative_states = [
            {
                "key": "node_i_only",
                "title": (
                    f"A  Node {pair_i} only"
                    if pair_i in basis_indices
                    else f"A  Node {pair_i}: mirror reuse"
                ),
                "capacitance_pf": single_node_pf[pair_i],
                "solution_source": (
                    "solved-basis-field"
                    if pair_i in basis_indices
                    else f"exact-reflection-of-node-{single_representatives[pair_i]}"
                ),
                "bias_plate_potentials_v": {
                    name: 1.0 if index == pair_i else 0.0
                    for index, name in enumerate(node_names)
                },
            },
            {
                "key": "node_j_only",
                "title": (
                    f"B  Node {pair_j} only"
                    if pair_j in basis_indices
                    else f"B  Node {pair_j}: mirror reuse"
                ),
                "capacitance_pf": single_node_pf[pair_j],
                "solution_source": (
                    "solved-basis-field"
                    if pair_j in basis_indices
                    else f"exact-reflection-of-node-{single_representatives[pair_j]}"
                ),
                "bias_plate_potentials_v": {
                    name: 1.0 if index == pair_j else 0.0
                    for index, name in enumerate(node_names)
                },
            },
            {
                "key": "pair_together",
                "title": (
                    "C  All bias plates (solved)"
                    if count == 2
                    else f"C  Reconstructed nodes {pair_i} + {pair_j}"
                ),
                "capacitance_pf": pair_node_pf[(pair_i, pair_j)],
                "solution_source": (
                    "solved-all-bias-field"
                    if count == 2
                    else "linear-reconstruction"
                ),
                "bias_plate_potentials_v": {
                    name: 1.0 if index in {pair_i, pair_j} else 0.0
                    for index, name in enumerate(node_names)
                },
            },
        ]
        network["representative_pair"] = [pair_i, pair_j]
        network["visualization_model"] = {
            "source": "fenicsx-full-capacitance-matrix-model",
            "geometry": axisymmetric_model.geometry_summary(local_p),
            "solved_bounds_mm": {
                "z_min": 0.0,
                "z_max": axisymmetric_model.stack_length_mm(local_p),
                "r_min": 0.0,
                "r_max": float(local_p["tube_id_mm"]) / 2.0,
            },
            "ground_potential_v": 0.0,
            "core_relative_permittivity": axisymmetric_model.core_capacitance_epsr(local_p),
            "excitation_states": representative_states,
        }
    network["mesh"] = {
        "target_fine_mm": mesh_sizes.get("fine"),
        "target_coarse_mm": mesh_sizes.get("coarse"),
        "edge_radius_ratio": mesh_sizes.get("edge_radius_ratio"),
    }
    network["geometry"] = axisymmetric_model.geometry_summary(local_p)
    return network


def _analytic_parallel_plate_cpar_pf(p: dict[str, Any]) -> float:
    """Core-plus-epoxy axial parallel-plate comparison value."""
    normalized = axisymmetric_model.normalize_parameters(dict(p))
    core_r = float(normalized["core_od_mm"]) / 2.0
    ground_r = float(normalized["ground_plate_inner_diameter_mm"]) / 2.0
    separation = (
        axisymmetric_model.ground_plate_thickness_mm(normalized)
        + 2.0 * float(normalized["plate_gap_mm"])
    )
    weighted_area = math.pi * (
        axisymmetric_model.core_capacitance_epsr(normalized) * core_r**2
        + float(normalized["epoxy_epsr"]) * max(0.0, ground_r**2 - core_r**2)
    )
    return EPSILON_0_PF_PER_MM * weighted_area / separation if separation > 0.0 else 0.0


def _analytic_two_washer_cg_pf(p: dict[str, Any]) -> float:
    """Two flat washer capacitors from one bias plate to its ground neighbors."""
    normalized = axisymmetric_model.normalize_parameters(dict(p))
    washer_inner, washer_outer = axisymmetric_model.washer_radial_bounds(normalized)
    overlap_inner = max(
        float(washer_inner),
        float(normalized["ground_plate_inner_diameter_mm"]) / 2.0,
    )
    overlap_outer = min(
        float(washer_outer),
        float(normalized["hv_plate_od_mm"]) / 2.0,
    )
    overlap_area = math.pi * max(0.0, overlap_outer**2 - overlap_inner**2)
    gap = float(normalized["plate_gap_mm"])
    if gap <= 0.0:
        return 0.0
    one_washer_pf = (
        EPSILON_0_PF_PER_MM
        * float(normalized["washer_epsr"])
        * overlap_area
        / gap
    )
    return 2.0 * one_washer_pf


def _representative_adjacent_bias_parasitic_capacitance(p: dict[str, Any], modules: dict[str, Any]) -> dict[str, Any] | None:
    """Estimate adjacent bias-plate Cpar using a local three-bias FEA solve.

    The ordinary field solve ties all HV conductors together. For stage-to-stage
    parasitic capacitance we instead drive the middle bias plate to 1 V with the
    two neighboring bias plates and all ground conductors at 0 V. A second solve
    drives both neighbors with the middle plate at 0 V, and a third drives all
    bias plates together. The polarization identity cancels every ground term
    without assuming that edge and middle plates have equal ground capacitance.
    """
    truncate_grounded_end = p.get("solve_strategy") == SOLVE_STRATEGY_END_REPEAT_APPROX
    local_strategy = (
        SOLVE_STRATEGY_MIRROR_HALF
        if p.get("solve_strategy") in {SOLVE_STRATEGY_MIRROR_HALF, SOLVE_STRATEGY_END_REPEAT_APPROX}
        else "full_stack"
    )
    local_p = axisymmetric_model.normalize_parameters({
        **p,
        "plate_pairs": 3,
        "bias_voltage_v": 1.0,
        "solve_strategy": local_strategy,
    })
    use_mirror_half = local_p.get("solve_strategy") == SOLVE_STRATEGY_MIRROR_HALF
    mirror_z_mm = axisymmetric_model.stack_length_mm(local_p) / 2.0 if use_mirror_half else None
    energy_scale = 2.0 if use_mirror_half else 1.0
    hv_centers = [z for kind, z in axisymmetric_model.plate_centers(local_p) if kind == "hv"]
    cut_z_mm = hv_centers[0] if truncate_grounded_end else 0.0
    solve_z_max_mm = hv_centers[1] if truncate_grounded_end else mirror_z_mm
    solved_z_extent_mm = solve_z_max_mm - cut_z_mm if solve_z_max_mm is not None else axisymmetric_model.stack_length_mm(local_p)
    gmsh = modules["gmsh"]
    mesh_sizes: dict[str, float] | None = None
    try:
        mesh_sizes = _build_gmsh_model(
            local_p,
            modules,
            include_core_dielectric=True,
            z_min_mm=cut_z_mm,
            z_max_mm=solve_z_max_mm,
        )
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
    ground_marker = _component_marker(
        local_p,
        modules,
        materials={"ground"},
        include_core_dielectric=True,
    )
    grounded_cut_conditions = (
        [(0.0, _grounded_outer_axial_cut_marker(local_p, cut_z_mm, modules))]
        if truncate_grounded_end
        else []
    )

    middle_only = _solve_potential_with_dirichlet_markers(
        mesh,
        local_p,
        modules,
        [
            (1.0, _component_marker(local_p, modules, names={middle_hv}, include_core_dielectric=True)),
            (0.0, _component_marker(local_p, modules, names=other_hv, include_core_dielectric=True)),
            (0.0, ground_marker),
            *grounded_cut_conditions,
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
        energy_scale=energy_scale,
    )

    neighbors_only = _solve_potential_with_dirichlet_markers(
        mesh,
        local_p,
        modules,
        [
            (1.0, _component_marker(local_p, modules, names=other_hv, include_core_dielectric=True)),
            (0.0, _component_marker(local_p, modules, names={middle_hv}, include_core_dielectric=True)),
            (0.0, ground_marker),
            *grounded_cut_conditions,
        ],
        include_core_dielectric=True,
    )
    neighbors_total = _capacitance_from_energy(
        mesh,
        neighbors_only,
        local_p,
        modules,
        voltage_v=1.0,
        include_core_dielectric=True,
        energy_scale=energy_scale,
    )

    all_bias = _solve_potential_with_dirichlet_markers(
        mesh,
        local_p,
        modules,
        [
            (1.0, _component_marker(local_p, modules, names=set(hv_components), include_core_dielectric=True)),
            (0.0, ground_marker),
            *grounded_cut_conditions,
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
        energy_scale=energy_scale,
    )

    neighbor_count = len(other_hv)
    raw_adjacent_pair_pf = _adjacent_pair_capacitance_from_energies(
        middle_total["total_pf"],
        neighbors_total["total_pf"],
        all_bias_to_ground["total_pf"],
        neighbor_count,
    )
    adjacent_pair_pf = max(0.0, raw_adjacent_pair_pf)
    raw_middle_ground_pf = _middle_ground_capacitance_from_energies(
        middle_total["total_pf"],
        neighbors_total["total_pf"],
        all_bias_to_ground["total_pf"],
    )
    middle_ground_pf = max(0.0, raw_middle_ground_pf)
    excitation_states = [
        {
            "key": "middle_only",
            "title": "A  Middle only",
            "capacitance_pf": middle_total["total_pf"],
            "bias_plate_potentials_v": {
                name: 1.0 if name == middle_hv else 0.0
                for name in hv_components
            },
        },
        {
            "key": "neighbors_only",
            "title": "B  Neighbors only",
            "capacitance_pf": neighbors_total["total_pf"],
            "bias_plate_potentials_v": {
                name: 0.0 if name == middle_hv else 1.0
                for name in hv_components
            },
        },
        {
            "key": "all_bias",
            "title": "C  All bias plates",
            "capacitance_pf": all_bias_to_ground["total_pf"],
            "bias_plate_potentials_v": {
                name: 1.0
                for name in hv_components
            },
        },
    ]
    return {
        "parasitic_pf": adjacent_pair_pf,
        "adjacent_bias_pf": adjacent_pair_pf,
        "bias_to_bias_pf": adjacent_pair_pf,
        "raw_adjacent_bias_pf": raw_adjacent_pair_pf,
        "middle_bias_to_ground_pf": middle_ground_pf,
        "raw_middle_bias_to_ground_pf": raw_middle_ground_pf,
        "middle_mutual_overcount_pf": max(
            0.0,
            middle_total["total_pf"] - middle_ground_pf,
        ),
        "middle_to_all_zero_pf": middle_total["total_pf"],
        "neighbors_to_middle_zero_pf": neighbors_total["total_pf"],
        "local_bias_to_ground_total_pf": all_bias_to_ground["total_pf"],
        "local_bias_plate_count": len(hv_components),
        "adjacent_neighbor_count": neighbor_count,
        "middle_bias_plate": middle_hv,
        "core_treatment": "dielectric-with-effective-permittivity",
        "core_electrode_treatment": "bias-plate-cross-section-electrodes",
        "method": (
            "fenicsx-three-bias-energy-polarization-grounded-neighbor-cut-approx"
            if truncate_grounded_end
            else "fenicsx-three-bias-energy-polarization"
        ),
        "symmetry_strategy": SOLVE_STRATEGY_MIRROR_HALF if use_mirror_half else "full_stack",
        "solved_z_extent_mm": solved_z_extent_mm,
        "grounded_neighbor_cut_approximation": truncate_grounded_end,
        "grounded_neighbor_cut_z_mm": cut_z_mm if truncate_grounded_end else None,
        "grounded_cut_radial_start_mm": float(local_p["hv_plate_od_mm"]) / 2.0 if truncate_grounded_end else None,
        "visualization_model": {
            "source": "fenicsx-cpar-normalized-model",
            "parameters": local_p,
            "geometry": axisymmetric_model.geometry_summary(local_p),
            "solved_bounds_mm": {
                "z_min": cut_z_mm,
                "z_max": solve_z_max_mm if solve_z_max_mm is not None else axisymmetric_model.stack_length_mm(local_p),
                "r_min": 0.0,
                "r_max": float(local_p["tube_id_mm"]) / 2.0,
            },
            "ground_potential_v": 0.0,
            "core_treatment": "dielectric-with-effective-permittivity",
            "core_relative_permittivity": axisymmetric_model.core_capacitance_epsr(local_p),
            "excitation_states": excitation_states,
            "mirror_reconstruction": {
                "strategy": SOLVE_STRATEGY_MIRROR_HALF if use_mirror_half else "full_stack",
                "neighbor_count": neighbor_count,
                "grounded_neighbor_cut_approximation": truncate_grounded_end,
            },
        },
        "description": (
            "Representative Cpar = (C_middle_only + C_neighbors_only - C_all_bias) "
            "/ (2 Nneighbors) from a local three-bias-plate energy-polarization solve "
            "with the core included as dielectric. The same states give "
            "Cg,middle = (C_middle_only - C_neighbors_only + C_all_bias) / 2, "
            "which removes the mutual capacitance counted when neighboring bias "
            "plates are held at ground."
            + (
                " The end ground/washer region is removed at the neighboring-bias center; "
                "the remaining outer cut annulus is held at ground."
                if truncate_grounded_end
                else ""
            )
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


def _cpar_gap_case_parameters(
    parameters: dict[str, Any],
    gap_mm: float,
    radial_overlap_mm: float,
) -> dict[str, Any]:
    """Return a normalized large-ground-hole Cpar validation geometry."""
    base = axisymmetric_model.normalize_parameters(dict(parameters))
    core_od = float(base["core_od_mm"])
    ground_id = core_od + 2.0 * float(gap_mm)
    hv_od = ground_id + 2.0 * float(radial_overlap_mm)
    tube_id = hv_od + 4.0
    return axisymmetric_model.normalize_parameters({
        **base,
        "washer_id_mode": "custom",
        "washer_od_mode": "custom",
        "ground_plate_inner_diameter_mm": ground_id,
        "washer_id_mm": ground_id,
        "hv_plate_od_mm": hv_od,
        "washer_od_mm": hv_od,
        "tube_id_mm": tube_id,
    })


def cpar_gap_sweep(
    parameters: dict[str, Any],
    gaps_mm: tuple[float, ...] = (2.0, 5.0, 10.0, 20.0, 25.0, 40.0, 50.0),
    radial_overlap_mm: float = 1.0,
) -> dict[str, Any]:
    """Compare FEA and axial analytic Cpar as ground shielding recedes."""
    base = axisymmetric_model.normalize_parameters(dict(parameters))
    modules = _import_fenicsx_modules()
    cases: list[dict[str, Any]] = []
    for gap_mm in gaps_mm:
        case = _cpar_gap_case_parameters(
            base,
            float(gap_mm),
            float(radial_overlap_mm),
        )
        fea = _representative_adjacent_bias_parasitic_capacitance(case, modules)
        if fea is None:
            continue
        analytic_pf = _analytic_parallel_plate_cpar_pf(case)
        stage_spacing = (
            axisymmetric_model.ground_plate_thickness_mm(case)
            + 2.0 * float(case["plate_gap_mm"])
        )
        ground_hole_radius = float(case["ground_plate_inner_diameter_mm"]) / 2.0
        cases.append({
            "core_ground_gap_mm": float(gap_mm),
            "ground_id_mm": float(case["ground_plate_inner_diameter_mm"]),
            "hv_od_mm": float(case["hv_plate_od_mm"]),
            "tube_id_mm": float(case["tube_id_mm"]),
            "normalized_core_ground_gap_mm": float(case["core_to_ground_gap_mm"]),
            "actual_radial_overlap_mm": (
                float(case["hv_plate_od_mm"])
                - float(case["ground_plate_inner_diameter_mm"])
            ) / 2.0,
            "hole_radius_to_stage_spacing": ground_hole_radius / stage_spacing,
            "analytic_cpar_pf": analytic_pf,
            "fea_cpar_pf": float(fea["parasitic_pf"]),
            "fea_over_analytic": float(fea["parasitic_pf"]) / analytic_pf if analytic_pf > 0.0 else None,
        })
    return {
        "method": "fenicsx-cpar-large-gap-consistency-sweep",
        "expectation": "FEA/analytic approaches 1 as the ground-hole radius becomes large relative to stage spacing.",
        "core_material": base.get("core_material"),
        "core_epsr": axisymmetric_model.core_capacitance_epsr(base),
        "epoxy_epsr": float(base["epoxy_epsr"]),
        "radial_overlap_mm": float(radial_overlap_mm),
        "cases": cases,
    }


def _bias_to_ground_method_comparison(
    p: dict[str, Any],
    modules: dict[str, Any],
    single_network: dict[str, Any] | None = None,
    three_network: dict[str, Any] | None = None,
    excitation_strategy: str = CAPACITANCE_STRATEGY_MIRROR,
) -> dict[str, Any]:
    """Compare direct one-bias Cg with a three-bias matrix row sum."""
    single_p = axisymmetric_model.normalize_parameters({
        **p,
        "plate_pairs": 1,
        "bias_voltage_v": 1.0,
        "solve_strategy": SOLVE_STRATEGY_MIRROR_HALF,
        "use_repeating_cell_approximation": False,
    })
    if single_network is None:
        single_network = _full_capacitance_network(
            single_p,
            modules,
            excitation_strategy=excitation_strategy,
        )
    single_ground_pf = float(single_network["node_ground_pf"][0])

    three_p = axisymmetric_model.normalize_parameters({
        **p,
        "plate_pairs": 3,
        "bias_voltage_v": 1.0,
        "solve_strategy": SOLVE_STRATEGY_MIRROR_HALF,
        "use_repeating_cell_approximation": False,
    })
    if three_network is None:
        three_network = _full_capacitance_network(
            three_p,
            modules,
            excitation_strategy=excitation_strategy,
        )
    maxwell_pf = three_network["maxwell_pf_matrix"]
    mutual_pf = three_network["mutual_pf_matrix"]
    middle_index = 1
    neighbor_indices = (0, 2)
    middle_only_pf = float(maxwell_pf[middle_index][middle_index])
    neighbors_only_pf = (
        float(maxwell_pf[0][0])
        + float(maxwell_pf[2][2])
        + 2.0 * float(maxwell_pf[0][2])
    )
    all_bias_pf = float(three_network["all_bias_equivalent_pf"])
    three_ground_pf = _middle_ground_capacitance_from_energies(
        middle_only_pf,
        neighbors_only_pf,
        all_bias_pf,
    )
    adjacent_cpar_pf = sum(
        float(mutual_pf[middle_index][neighbor])
        for neighbor in neighbor_indices
    ) / len(neighbor_indices)
    mutual_overcount_pf = middle_only_pf - three_ground_pf
    difference_pf = three_ground_pf - single_ground_pf
    difference_fraction = difference_pf / single_ground_pf if single_ground_pf > 0.0 else None
    single_model = {
        "source": "fenicsx-single-bias-cg-comparison",
        "parameters": single_p,
        "geometry": axisymmetric_model.geometry_summary(single_p),
        "solved_bounds_mm": {
            "z_min": 0.0,
            "z_max": axisymmetric_model.stack_length_mm(single_p),
            "r_min": 0.0,
            "r_max": float(single_p["tube_id_mm"]) / 2.0,
        },
        "ground_potential_v": 0.0,
        "core_treatment": "dielectric-with-effective-permittivity",
        "core_relative_permittivity": axisymmetric_model.core_capacitance_epsr(single_p),
        "excitation_states": [
            {
                "key": "single_bias_only",
                "title": "Single bias plate",
                "capacitance_pf": single_ground_pf,
                "bias_plate_potentials_v": {
                    single_network["node_names"][0]: 1.0,
                },
            }
        ],
    }
    three_names = list(three_network["node_names"])
    three_model = {
        "source": "fenicsx-three-bias-cg-matrix-comparison",
        "parameters": three_p,
        "geometry": axisymmetric_model.geometry_summary(three_p),
        "solved_bounds_mm": {
            "z_min": 0.0,
            "z_max": axisymmetric_model.stack_length_mm(three_p),
            "r_min": 0.0,
            "r_max": float(three_p["tube_id_mm"]) / 2.0,
        },
        "ground_potential_v": 0.0,
        "core_treatment": "dielectric-with-effective-permittivity",
        "core_relative_permittivity": axisymmetric_model.core_capacitance_epsr(three_p),
        "excitation_states": [
            {
                "key": "middle_only",
                "title": "A  Middle only",
                "capacitance_pf": middle_only_pf,
                "bias_plate_potentials_v": {
                    name: 1.0 if index == middle_index else 0.0
                    for index, name in enumerate(three_names)
                },
            },
            {
                "key": "neighbors_only",
                "title": "B  Mirrored neighbors together",
                "capacitance_pf": neighbors_only_pf,
                "bias_plate_potentials_v": {
                    name: 0.0 if index == middle_index else 1.0
                    for index, name in enumerate(three_names)
                },
                "solution_source": "linear reconstruction from exact mirror basis fields",
            },
            {
                "key": "all_bias",
                "title": "C  All bias plates",
                "capacitance_pf": all_bias_pf,
                "bias_plate_potentials_v": {name: 1.0 for name in three_names},
            },
        ],
        "mirror_reconstruction": {
            "strategy": "full-stack exact reflection reuse",
            "basis_solve_representatives": three_network["single_excitation_representatives"],
        },
    }
    return {
        "method": "fenicsx-one-bias-versus-three-bias-ground-capacitance",
        "single_bias_geometry_pf": single_ground_pf,
        "single_bias_equivalent_pf": float(single_network["single_node_equivalent_pf"][0]),
        "three_bias_middle_ground_pf": three_ground_pf,
        "three_bias_matrix_row_sum_pf": float(three_network["node_ground_pf"][middle_index]),
        "three_bias_middle_only_equivalent_pf": middle_only_pf,
        "three_bias_neighbors_only_equivalent_pf": neighbors_only_pf,
        "three_bias_all_bias_equivalent_pf": all_bias_pf,
        "three_bias_adjacent_cpar_pf": adjacent_cpar_pf,
        "three_bias_neighbor_count": len(neighbor_indices),
        "three_bias_mutual_overcount_pf": mutual_overcount_pf,
        "three_minus_single_pf": difference_pf,
        "three_minus_single_fraction": difference_fraction,
        "single_bias_visualization_model": single_model,
        "three_bias_visualization_model": three_model,
        "formula": "Cg,middle = (Cmiddle + Call - Cneighbors) / 2 = Cmiddle - Nneighbors*Cpar",
        "interpretation": (
            "The middle-only diagonal includes mutual capacitance to every bias "
            "plate held at zero volts. The three-state polarization subtraction "
            "removes those terms. The one-bias geometry provides an independent "
            "case with no bias-to-bias mutual capacitance to subtract."
        ),
    }


def _cg_matrix_plate_count_comparison(
    two_network: dict[str, Any],
    three_network: dict[str, Any],
) -> dict[str, Any]:
    """Compare end and interior Cg using exact two- and three-node matrices."""
    two_ground = [float(value) for value in two_network["node_ground_pf"]]
    three_ground = [float(value) for value in three_network["node_ground_pf"]]
    two_mean = sum(two_ground) / len(two_ground)
    three_end_mean = (three_ground[0] + three_ground[-1]) / 2.0
    three_center = three_ground[1]
    return {
        "method": "fenicsx-two-versus-three-bias-cg-matrix",
        "two_bias_node_ground_pf": two_ground,
        "two_bias_mean_ground_pf": two_mean,
        "three_bias_node_ground_pf": three_ground,
        "three_bias_end_mean_ground_pf": three_end_mean,
        "three_bias_center_ground_pf": three_center,
        "three_end_minus_two_pf": three_end_mean - two_mean,
        "three_end_minus_two_fraction": (
            (three_end_mean - two_mean) / two_mean if two_mean > 0.0 else None
        ),
        "three_center_minus_two_pf": three_center - two_mean,
        "three_center_minus_two_fraction": (
            (three_center - two_mean) / two_mean if two_mean > 0.0 else None
        ),
        "two_bias_energy_solve_count": int(two_network["energy_solve_count"]),
        "three_bias_energy_solve_count": int(three_network["energy_solve_count"]),
        "two_bias_solves_saved": int(two_network["energy_solves_saved"]),
        "three_bias_solves_saved": int(three_network["energy_solves_saved"]),
        "two_bias_representatives": list(two_network["single_excitation_representatives"]),
        "three_bias_representatives": list(three_network["single_excitation_representatives"]),
        "repeating_adds_small_matrix_reduction": False,
        "repeating_note": (
            "Two bias plates have no interior node and three bias plates have only "
            "one interior node, so the repeating-interior assumption adds no "
            "equivalence beyond exact reflection for this comparison."
        ),
    }


def capacitance_strategy_sweep(
    parameters: dict[str, Any],
    plate_counts: tuple[int, ...] = (2, 3, 4, 5),
) -> dict[str, Any]:
    """Compare full, exact-mirror, and repeating capacitance extractions."""
    base = axisymmetric_model.normalize_parameters(dict(parameters))
    modules = _import_fenicsx_modules()
    cases: list[dict[str, Any]] = []
    strategies = (
        CAPACITANCE_STRATEGY_FULL,
        CAPACITANCE_STRATEGY_MIRROR,
        CAPACITANCE_STRATEGY_REPEAT,
    )
    for plate_count in plate_counts:
        case_parameters = axisymmetric_model.normalize_parameters({
            **base,
            "plate_pairs": int(plate_count),
        })
        analytic_pf = _analytic_parallel_plate_cpar_pf(case_parameters)
        for strategy in strategies:
            started = time.perf_counter()
            network = _full_capacitance_network(
                case_parameters,
                modules,
                excitation_strategy=strategy,
            )
            elapsed_s = time.perf_counter() - started
            adjacent_pf = [float(value) for value in network["adjacent_mutual_pf"]]
            average_pf = float(network["average_adjacent_mutual_pf"])
            cases.append({
                "plate_count": int(plate_count),
                "strategy": strategy,
                "adjacent_cpar_pf": adjacent_pf,
                "average_adjacent_cpar_pf": average_pf,
                "analytic_cpar_pf": analytic_pf,
                "fea_over_analytic": average_pf / analytic_pf if analytic_pf > 0.0 else None,
                "node_ground_pf": [float(value) for value in network["node_ground_pf"]],
                "energy_solve_count": int(network["energy_solve_count"]),
                "energy_solve_count_without_symmetry": int(
                    network["energy_solve_count_without_symmetry"]
                ),
                "elapsed_s": elapsed_s,
            })
    return {
        "method": "fenicsx-capacitance-strategy-consistency",
        "expectation": (
            "Full and exact-mirror results agree to numerical precision. "
            "For two through five nodes, repeating mode preserves adjacent Cpar; "
            "it may collapse interior Cg values by design."
        ),
        "geometry": axisymmetric_model.geometry_summary(base),
        "cases": cases,
    }


def cg_strategy_sweep(
    parameters: dict[str, Any],
    plate_counts: tuple[int, ...] = (1, 2, 3, 4, 5),
) -> dict[str, Any]:
    """Compare node-resolved Cg under full, mirror, and repeating treatments."""
    base = axisymmetric_model.normalize_parameters(dict(parameters))
    modules = _import_fenicsx_modules()
    cases: list[dict[str, Any]] = []
    strategies = (
        CAPACITANCE_STRATEGY_FULL,
        CAPACITANCE_STRATEGY_MIRROR,
        CAPACITANCE_STRATEGY_REPEAT,
    )
    for plate_count in plate_counts:
        case_parameters = axisymmetric_model.normalize_parameters({
            **base,
            "plate_pairs": int(plate_count),
        })
        analytic_pf = _analytic_two_washer_cg_pf(case_parameters)
        networks: dict[str, dict[str, Any]] = {}
        elapsed_by_strategy: dict[str, float] = {}
        for strategy in strategies:
            started = time.perf_counter()
            networks[strategy] = _full_capacitance_network(
                case_parameters,
                modules,
                excitation_strategy=strategy,
            )
            elapsed_by_strategy[strategy] = time.perf_counter() - started

        node_values = {
            strategy: [
                float(value) for value in networks[strategy]["node_ground_pf"]
            ]
            for strategy in strategies
        }
        full_pf = node_values[CAPACITANCE_STRATEGY_FULL]
        mirror_pf = node_values[CAPACITANCE_STRATEGY_MIRROR]
        repeat_pf = node_values[CAPACITANCE_STRATEGY_REPEAT]
        average_pf = sum(mirror_pf) / len(mirror_pf)
        max_full_reflection_difference_pf = max(
            abs(full_pf[index] - full_pf[-1 - index])
            for index in range(plate_count)
        )
        max_full_vs_mirror_pf = max(
            abs(full_pf[index] - mirror_pf[index])
            for index in range(plate_count)
        )
        max_repeat_vs_mirror_pf = max(
            abs(repeat_pf[index] - mirror_pf[index])
            for index in range(plate_count)
        )
        cases.append({
            "plate_count": int(plate_count),
            "analytic_two_washer_cg_pf": analytic_pf,
            "full_node_cg_pf": full_pf,
            "mirror_node_cg_pf": mirror_pf,
            "repeat_node_cg_pf": repeat_pf,
            "average_mirror_cg_pf": average_pf,
            "fea_over_analytic": average_pf / analytic_pf if analytic_pf > 0.0 else None,
            "max_full_reflection_difference_pf": max_full_reflection_difference_pf,
            "max_full_vs_mirror_pf": max_full_vs_mirror_pf,
            "max_repeat_vs_mirror_pf": max_repeat_vs_mirror_pf,
            "max_full_vs_mirror_fraction": (
                max_full_vs_mirror_pf / average_pf if average_pf > 0.0 else None
            ),
            "max_repeat_vs_mirror_fraction": (
                max_repeat_vs_mirror_pf / average_pf if average_pf > 0.0 else None
            ),
            "all_bias_equivalent_pf": float(
                networks[CAPACITANCE_STRATEGY_MIRROR]["all_bias_equivalent_pf"]
            ),
            "elapsed_s_by_strategy": elapsed_by_strategy,
        })
    return {
        "method": "fenicsx-cg-strategy-consistency",
        "expectation": (
            "Full-stack Cg approaches exact reflection symmetry within mesh "
            "discretization error. Mirror averaging removes that asymmetry. "
            "Repeating mode may average small end-effect differences among "
            "interior nodes but must preserve total and average Cg."
        ),
        "geometry": axisymmetric_model.geometry_summary(base),
        "cases": cases,
    }


def cpar_limiting_geometry_sweep(
    parameters: dict[str, Any],
    outer_diameters_mm: tuple[float, ...] = (24.0, 40.0, 80.0, 120.0),
) -> dict[str, Any]:
    """Move grounded edges outward until the axial parallel-plate limit holds."""
    base = dict(parameters)
    modules = _import_fenicsx_modules()
    cases: list[dict[str, Any]] = []
    for outer_diameter_mm in outer_diameters_mm:
        outer = float(outer_diameter_mm)
        ground_id = outer - 4.0
        bias_od = outer - 2.0
        case = axisymmetric_model.normalize_parameters({
            **base,
            "plate_pairs": 3,
            "solve_strategy": SOLVE_STRATEGY_MIRROR_HALF,
            "use_repeating_cell_approximation": False,
            "core_material": "type61",
            "use_direct_stage_circuit": False,
            "ferrite_epsr": 3.4,
            "epoxy_epsr": 3.4,
            "washer_epsr": 3.4,
            "tube_id_mm": outer,
            "ground_plate_inner_diameter_mm": ground_id,
            "hv_plate_od_mm": bias_od,
            "washer_id_mode": "custom",
            "washer_od_mode": "custom",
            "washer_id_mm": float(base.get("core_od_mm", 2.2)),
            "washer_od_mm": bias_od,
        })
        started = time.perf_counter()
        network = _full_capacitance_network(
            case,
            modules,
            excitation_strategy=CAPACITANCE_STRATEGY_MIRROR,
        )
        elapsed_s = time.perf_counter() - started
        analytic_pf = _analytic_parallel_plate_cpar_pf(case)
        fea_pf = float(network["average_adjacent_mutual_pf"])
        stage_spacing = (
            axisymmetric_model.ground_plate_thickness_mm(case)
            + 2.0 * float(case["plate_gap_mm"])
        )
        cases.append({
            "tube_and_ground_od_mm": float(case["tube_id_mm"]),
            "ground_id_mm": float(case["ground_plate_inner_diameter_mm"]),
            "bias_od_mm": float(case["hv_plate_od_mm"]),
            "ground_annulus_radial_width_mm": (
                float(case["ground_plate_od_mm"])
                - float(case["ground_plate_inner_diameter_mm"])
            ) / 2.0,
            "ground_hole_radius_to_stage_spacing": (
                float(case["ground_plate_inner_diameter_mm"]) / 2.0
            ) / stage_spacing,
            "analytic_cpar_pf": analytic_pf,
            "fea_cpar_pf": fea_pf,
            "fea_over_analytic": fea_pf / analytic_pf if analytic_pf > 0.0 else None,
            "adjacent_cpar_pf": [
                float(value) for value in network["adjacent_mutual_pf"]
            ],
            "energy_solve_count": int(network["energy_solve_count"]),
            "elapsed_s": elapsed_s,
        })
    return {
        "method": "fenicsx-cpar-wide-disc-analytic-limit",
        "expectation": (
            "FEA/analytic approaches 1 as the narrow grounded annulus and tube "
            "move radially far from most of the axial-field area."
        ),
        "dielectric_epsr": 3.4,
        "plate_count": 3,
        "cases": cases,
    }


def _cg_limiting_geometry_case(
    parameters: dict[str, Any],
    bias_diameter_mm: float,
    modules: dict[str, Any],
) -> dict[str, Any]:
    """Solve one wide-disc, one-bias Cg case with exact mirror symmetry."""
    base = dict(parameters)
    core_od = 2.0
    ground_id = core_od + 0.20
    bias_od = float(bias_diameter_mm)
    tube_id = bias_od + 4.0
    case = axisymmetric_model.normalize_parameters({
        **base,
        "plate_pairs": 1,
        "solve_strategy": SOLVE_STRATEGY_MIRROR_HALF,
        "use_repeating_cell_approximation": False,
        "core_material": "type61",
        "core_od_mm": core_od,
        "use_direct_stage_circuit": False,
        "ferrite_epsr": 3.4,
        "epoxy_epsr": 3.4,
        "washer_epsr": 3.4,
        "tube_id_mm": tube_id,
        "ground_plate_inner_diameter_mm": ground_id,
        "hv_plate_od_mm": bias_od,
        "washer_id_mode": "ground_id",
        "washer_od_mode": "bias_od",
        "washer_id_mm": ground_id,
        "washer_od_mm": bias_od,
    })
    mirror_z_mm = axisymmetric_model.stack_length_mm(case) / 2.0
    gmsh = modules["gmsh"]
    started = time.perf_counter()
    try:
        mesh_sizes = _build_gmsh_model(
            case,
            modules,
            include_core_dielectric=True,
            z_max_mm=mirror_z_mm,
        )
        mesh = _model_to_mesh(modules)
    finally:
        gmsh.finalize()
    hv_marker = _component_marker(
        case,
        modules,
        materials={"hv"},
        include_core_dielectric=True,
    )
    ground_marker = _component_marker(
        case,
        modules,
        materials={"ground"},
        include_core_dielectric=True,
    )
    potential = _solve_potential_with_dirichlet_markers(
        mesh,
        case,
        modules,
        [(1.0, hv_marker), (0.0, ground_marker)],
        include_core_dielectric=True,
    )
    capacitance = _capacitance_from_energy(
        mesh,
        potential,
        case,
        modules,
        voltage_v=1.0,
        energy_scale=2.0,
        include_core_dielectric=True,
    )
    elapsed_s = time.perf_counter() - started
    analytic_pf = _analytic_two_washer_cg_pf(case)
    fea_pf = float(capacitance["total_pf"])
    overlap_inner, overlap_outer = axisymmetric_model.washer_radial_bounds(case)
    overlap_width = float(overlap_outer) - float(overlap_inner)
    return {
        "plate_count": 1,
        "symmetry_strategy": "exact-center-plane-mirror",
        "bias_od_mm": float(case["hv_plate_od_mm"]),
        "tube_and_ground_od_mm": float(case["tube_id_mm"]),
        "core_od_mm": float(case["core_od_mm"]),
        "ground_id_mm": float(case["ground_plate_inner_diameter_mm"]),
        "core_to_ground_radial_gap_mm": (
            float(case["ground_plate_inner_diameter_mm"])
            - float(case["core_od_mm"])
        ) / 2.0,
        "washer_overlap_radial_width_mm": overlap_width,
        "analytic_two_washer_cg_pf": analytic_pf,
        "fea_cg_pf": fea_pf,
        "fea_over_analytic": fea_pf / analytic_pf if analytic_pf > 0.0 else None,
        "energy_solve_count": 1,
        "solved_z_extent_mm": mirror_z_mm,
        "mesh": {
            "target_fine_mm": mesh_sizes.get("fine"),
            "target_coarse_mm": mesh_sizes.get("coarse"),
            "edge_radius_ratio": mesh_sizes.get("edge_radius_ratio"),
        },
        "elapsed_s": elapsed_s,
    }


def cg_limiting_geometry_sweep(
    parameters: dict[str, Any],
    bias_diameters_mm: tuple[float, ...] = (12.0, 24.0, 40.0, 80.0, 120.0),
) -> dict[str, Any]:
    """Widen plate overlap, isolating each large PETSc solve in a subprocess."""
    cases: list[dict[str, Any]] = []
    for bias_diameter_mm in bias_diameters_mm:
        completed = subprocess.run(
            [
                sys.executable,
                __file__,
                "--validate-cg-wide-disc-case",
                str(float(bias_diameter_mm)),
            ],
            input=json.dumps(parameters),
            text=True,
            capture_output=True,
            check=False,
            timeout=900,
        )
        if completed.returncode != 0:
            raise RuntimeError(
                f"Cg limiting case {bias_diameter_mm:g} mm failed: "
                f"{completed.stderr.strip() or completed.stdout.strip()}"
            )
        cases.append(json.loads(completed.stdout))
    return {
        "method": "fenicsx-cg-wide-disc-analytic-limit",
        "expectation": (
            "FEA/analytic approaches 1 as ground ID approaches core OD and "
            "the shared bias/ground washer-overlap radius grows, making inner "
            "and outer fringing small relative to the axial field area."
        ),
        "validation_history": [
            {
                "attempt": "initial-oversized-sweep",
                "bias_diameters_mm": [12.0, 24.0, 40.0, 80.0, 120.0],
                "status": "aborted-before-results",
                "reason": (
                    "The 120 mm full-stack basis solve reached about 5.68 GiB "
                    "RSS after 6 minutes 49 seconds. The initial geometry used "
                    "a 0.01 mm core-to-ground radial gap, which forced a "
                    "0.024 mm global coarse mesh target across the wide disc."
                ),
                "fix": (
                    "Reduce model size while separating matrix-consistency and "
                    "analytical-limit questions; preserve the failed attempt."
                ),
            },
            {
                "attempt": "64-mm-capped-sweep",
                "bias_diameters_mm": [12.0, 24.0, 40.0, 64.0],
                "status": "aborted-before-results",
                "reason": (
                    "The 64 mm case still reached about 5.65 GiB RSS after "
                    "4 minutes 43 seconds in the same 0.01 mm-gap, full-stack "
                    "multi-basis formulation."
                ),
                "fix": (
                    "Cap the routine validation at 40 mm. The retained 12, 24, "
                    "and 40 mm cases still increase overlap area by more than "
                    "an order of magnitude and are checked for monotonic "
                    "approach to the analytical result."
                ),
            },
            {
                "attempt": "40-mm-capped-single-process-sweep",
                "bias_diameters_mm": [12.0, 24.0, 40.0],
                "status": "aborted-before-results",
                "reason": (
                    "Even the 40 mm batch reached about 5.68 GiB RSS after "
                    "5 minutes 9 seconds. At the time, similar plateaus "
                    "suggested retained PETSc allocations. The later completed "
                    "single-plate sweep showed that the dominant cause was the "
                    "0.01 mm gap imposing 0.006/0.024 mm fine/coarse targets "
                    "over the entire widening radial domain."
                ),
                "fix": (
                    "Separate the questions. Matrix consistency is checked for "
                    "one through five plates on ordinary geometry. The Cg "
                    "analytical limit uses one bias plate, exact center-plane "
                    "mirror symmetry, and one energy solve per diameter. Each "
                    "diameter runs in a fresh subprocess so its mesh and PETSc "
                    "state are released before the next case."
                ),
            },
            {
                "attempt": "isolated-subprocess-runner-first-launch",
                "status": "failed-before-fea",
                "reason": (
                    "A redundant local import of sys inside main() shadowed "
                    "the module-level sys used to read child-case JSON, causing "
                    "UnboundLocalError before the first FEA solve."
                ),
                "fix": (
                    "Remove the local import and retain the module-level sys "
                    "import. Geometry, meshing, equations, and capacitance "
                    "extraction were unchanged."
                ),
            },
            {
                "attempt": "completed-0.01-mm-gap-exact-mirror-sweep",
                "bias_diameters_mm": [12.0, 24.0, 40.0, 64.0],
                "status": "completed-but-resource-heavy",
                "result_file": "cg-wide-disc-validation-tight-gap.json",
                "fea_over_analytic": [
                    1.4424244598,
                    1.2037189325,
                    1.1185443277,
                    1.0728616572,
                ],
                "finding": (
                    "The ratios converged monotonically toward 1, so the FEA "
                    "scaling was correct. The 0.01 mm radial gap was much "
                    "smaller than needed to make the inner missing area "
                    "negligible and caused global overrefinement."
                ),
                "fix": (
                    "Use a 0.10 mm radial core-to-ground gap (2.0 mm core, "
                    "2.2 mm ground ID). It remains small relative to the disc "
                    "radii while permitting larger analytical-limit cases "
                    "without heavy swap or excessive memory."
                ),
            },
        ],
        "dielectric_epsr": 3.4,
        "plate_count": 1,
        "symmetry_strategy": "exact-center-plane-mirror",
        "cases": cases,
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
    potential_fn: Any,
    p: dict[str, Any],
    modules: dict[str, Any],
    mesh_sizes: dict[str, float] | None = None,
    mirror_z_mm: float | None = None,
    repeat_mesh: Any | None = None,
    repeat_field_fn: Any | None = None,
    repeat_potential_fn: Any | None = None,
    repeat_z_bounds_mm: tuple[float, float] | None = None,
    end_z_max_mm: float | None = None,
) -> dict[str, Any]:
    grid = axisymmetric_model.build_grid(p)
    r_coords = grid["r_coords"]
    z_coords = grid["z_coords"]
    labels = grid["labels"]
    materials = grid["materials"]
    nr = grid["nr"]
    nz = grid["nz"]
    length = axisymmetric_model.stack_length_mm(p)

    sample_points: list[tuple[int, int, float, float, str, int]] = []
    main_eval_points: list[tuple[float, float]] = []
    repeat_eval_points: list[tuple[float, float]] = []
    main_point_indices: dict[tuple[float, float], int] = {}
    repeat_point_indices: dict[tuple[float, float], int] = {}

    def unique_point_index(
        points: list[tuple[float, float]],
        indices: dict[tuple[float, float], int],
        r: float,
        z: float,
    ) -> int:
        # Reconstructed cells map onto the same local FEA coordinates.  Round
        # away accumulated copy/mirror arithmetic noise so each local point is
        # evaluated once, then reused for every physical cell copy.
        key = (round(float(r), 12), round(float(z), 12))
        if key not in indices:
            indices[key] = len(points)
            points.append((float(r), float(z)))
        return indices[key]

    use_end_repeat = (
        repeat_mesh is not None
        and repeat_field_fn is not None
        and repeat_potential_fn is not None
        and repeat_z_bounds_mm is not None
        and end_z_max_mm is not None
    )
    canonical_end_z: list[float] = []
    canonical_repeat_z: list[float] = []
    if use_end_repeat:
        repeat_z_min, repeat_z_max = repeat_z_bounds_mm
        half_cell_length = repeat_z_max - repeat_z_min
        canonical_end_z = [
            float(z) for z in z_coords if 0.0 <= z <= end_z_max_mm
        ]
        canonical_repeat_z = [
            repeat_z_min + (float(z) - end_z_max_mm)
            for z in z_coords
            if end_z_max_mm <= z <= end_z_max_mm + half_cell_length
        ]

    def nearest_coordinate(value: float, coordinates: list[float]) -> float:
        if not coordinates:
            return float(value)
        position = bisect.bisect_left(coordinates, value)
        if position <= 0:
            return coordinates[0]
        if position >= len(coordinates):
            return coordinates[-1]
        below = coordinates[position - 1]
        above = coordinates[position]
        return below if value - below <= above - value else above

    for i, r in enumerate(r_coords):
        for j, z in enumerate(z_coords):
            if labels[i][j] != "dielectric":
                continue
            if z < 0.0 or z > length:
                continue
            if use_end_repeat:
                if z <= end_z_max_mm:
                    source = "end"
                    solve_z = z
                    source_index = unique_point_index(
                        main_eval_points, main_point_indices, r, solve_z
                    )
                elif z >= length - end_z_max_mm:
                    source = "end"
                    solve_z = nearest_coordinate(length - z, canonical_end_z)
                    source_index = unique_point_index(
                        main_eval_points, main_point_indices, r, solve_z
                    )
                else:
                    source = "repeat"
                    repeat_z_min, repeat_z_max = repeat_z_bounds_mm
                    half_cell_length = repeat_z_max - repeat_z_min
                    offset = z - end_z_max_mm
                    half_cell_index = int(math.floor(offset / half_cell_length))
                    local_z = offset - half_cell_index * half_cell_length
                    solve_z = (
                        repeat_z_min + local_z
                        if half_cell_index % 2 == 0
                        else repeat_z_max - local_z
                    )
                    solve_z = nearest_coordinate(solve_z, canonical_repeat_z)
                    source_index = unique_point_index(
                        repeat_eval_points, repeat_point_indices, r, solve_z
                    )
            else:
                source = "end"
                solve_z = min(z, 2.0 * mirror_z_mm - z) if mirror_z_mm is not None and z > mirror_z_mm else z
                source_index = unique_point_index(
                    main_eval_points, main_point_indices, r, solve_z
                )
            sample_points.append((i, j, r, z, source, source_index))

    main_values = _eval_function_at_points(field_fn, mesh, main_eval_points, modules)
    repeat_values = _eval_function_at_points(repeat_field_fn, repeat_mesh, repeat_eval_points, modules) if use_end_repeat else []
    main_potentials = _eval_function_at_points(potential_fn, mesh, main_eval_points, modules)
    repeat_potentials = (
        _eval_function_at_points(repeat_potential_fn, repeat_mesh, repeat_eval_points, modules)
        if use_end_repeat
        else []
    )
    field = [[0.0 for _ in range(nz)] for _ in range(nr)]
    potential: list[list[float | None]] = [[None for _ in range(nz)] for _ in range(nr)]
    for i in range(nr):
        for j, z in enumerate(z_coords):
            if z < 0.0 or z > length:
                continue
            if labels[i][j] == "hv":
                potential[i][j] = float(p["bias_voltage_v"])
            elif labels[i][j] == "ground":
                potential[i][j] = 0.0
    raw_max_field = 0.0
    raw_max_location = (0.0, 0.0)
    raw_dielectric_peaks = {
        "washer": {"key": "washer", "maxField": 0.0, "maxLocation": {"r": 0.0, "z": 0.0}},
        "epoxy": {"key": "epoxy", "maxField": 0.0, "maxLocation": {"r": 0.0, "z": 0.0}},
    }

    for i, j, r, z, source, source_index in sample_points:
        value = main_values[source_index] if source == "end" else repeat_values[source_index]
        potential_value = main_potentials[source_index] if source == "end" else repeat_potentials[source_index]
        if potential_value is not None and math.isfinite(potential_value):
            potential[i][j] = potential_value
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
        "symmetry_strategy": (
            SOLVE_STRATEGY_END_REPEAT_APPROX
            if use_end_repeat
            else SOLVE_STRATEGY_MIRROR_HALF if mirror_z_mm is not None else "full_stack"
        ),
        "solved_z_extent_mm": (
            end_z_max_mm + (repeat_z_bounds_mm[1] - repeat_z_bounds_mm[0])
            if use_end_repeat
            else mirror_z_mm if mirror_z_mm is not None else length
        ),
        "reconstructed_full_stack": mirror_z_mm is not None or use_end_repeat,
        "approximation": "two-equivalent-ends-plus-mirrored-repeating-interior-half-cell" if use_end_repeat else None,
        "unique_main_sample_points": len(main_eval_points),
        "unique_repeat_sample_points": len(repeat_eval_points),
        "reconstructed_dielectric_sample_points": len(sample_points),
    }
    return {
        "grid": grid,
        "field": field,
        "potential": potential,
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
    requested_strategy = p.get("solve_strategy")
    use_end_repeat = requested_strategy == SOLVE_STRATEGY_END_REPEAT_APPROX and int(p["plate_pairs"]) >= 2
    use_mirror_half = requested_strategy == SOLVE_STRATEGY_MIRROR_HALF or (
        requested_strategy == SOLVE_STRATEGY_END_REPEAT_APPROX and not use_end_repeat
    )
    mirror_z_mm = axisymmetric_model.stack_length_mm(p) / 2.0 if use_mirror_half else None
    mesh_sizes: dict[str, float] | None = None
    repeat_mesh = None
    repeat_uh = None
    repeat_field_fn = None
    repeat_z_bounds_mm: tuple[float, float] | None = None
    end_z_max_mm: float | None = None
    if use_end_repeat:
        centers = axisymmetric_model.plate_centers(p)
        first_bias_center = next(z for kind, z in centers if kind == "hv")
        second_ground_center = [z for kind, z in centers if kind == "ground"][1]
        end_z_max_mm = first_bias_center
        repeat_z_bounds_mm = (first_bias_center, second_ground_center)
        try:
            mesh_sizes = _build_gmsh_model(p, modules, z_max_mm=end_z_max_mm)
            mesh = _model_to_mesh(modules)
        finally:
            gmsh.finalize()
        uh = _solve_potential(mesh, p, modules)
        end_capacitance = _capacitance_from_energy(mesh, uh, p, modules)

        try:
            _build_gmsh_model(
                p,
                modules,
                z_min_mm=repeat_z_bounds_mm[0],
                z_max_mm=repeat_z_bounds_mm[1],
            )
            repeat_mesh = _model_to_mesh(modules)
        finally:
            gmsh.finalize()
        repeat_uh = _solve_potential(repeat_mesh, p, modules)
        repeat_capacitance = _capacitance_from_energy(repeat_mesh, repeat_uh, p, modules)
        repeat_count = 2 * (int(p["plate_pairs"]) - 1)
        energy_pj = 2.0 * end_capacitance["energy_pj"] + repeat_count * repeat_capacitance["energy_pj"]
        voltage = abs(float(p["bias_voltage_v"]))
        total_pf = 2.0 * energy_pj / (voltage * voltage) if voltage > 0.0 else 0.0
        capacitance = {
            **end_capacitance,
            "total_pf": total_pf,
            "bias_to_ground_pf": total_pf,
            "energy_pj": energy_pj,
            "method": "fenicsx-end-repeat-energy-approx",
            "description": "C = 2U/V^2 using two mirrored end regions plus copied/mirrored interior half-cell energy.",
            "symmetry_strategy": SOLVE_STRATEGY_END_REPEAT_APPROX,
            "end_cell_energy_pj": end_capacitance["energy_pj"],
            "interior_half_cell_energy_pj": repeat_capacitance["energy_pj"],
            "interior_copy_or_mirror_count": repeat_count,
            "solved_z_extent_mm": end_z_max_mm + repeat_z_bounds_mm[1] - repeat_z_bounds_mm[0],
            "approximate": True,
        }
    else:
        try:
            mesh_sizes = _build_gmsh_model(p, modules, z_max_mm=mirror_z_mm)
            mesh = _model_to_mesh(modules)
        finally:
            gmsh.finalize()
        uh = _solve_potential(mesh, p, modules)
        capacitance = _capacitance_from_energy(mesh, uh, p, modules, energy_scale=2.0 if use_mirror_half else 1.0)
        capacitance["symmetry_strategy"] = SOLVE_STRATEGY_MIRROR_HALF if use_mirror_half else "full_stack"
        capacitance["solved_z_extent_mm"] = mirror_z_mm or axisymmetric_model.stack_length_mm(p)
    if use_end_repeat:
        capacitance_network = _repeating_capacitance_network(
            p,
            end_capacitance["total_pf"],
            repeat_capacitance["total_pf"],
        )
    else:
        capacitance_network = _full_capacitance_network(p, modules)
    capacitance["field_model_total_pf"] = capacitance["total_pf"]
    capacitance["field_model_energy_pj"] = capacitance["energy_pj"]
    capacitance["total_pf"] = capacitance_network["total_ground_pf"]
    capacitance["bias_to_ground_pf"] = capacitance_network["total_ground_pf"]
    capacitance["network_all_bias_equivalent_pf"] = capacitance_network["all_bias_equivalent_pf"]
    capacitance["capacitance_network"] = capacitance_network
    capacitance["description"] = (
        "Fast SPICE screening network: total all-bias capacitance comes from "
        "the symmetric end/repeating-region FEA; per-node Cg is a regional "
        "energy allocation rather than a Maxwell row sum, and adjacent Cpar "
        "uses the local analytical estimate."
        if use_end_repeat
        else
        "Node-resolved FEniCSx capacitance matrix from single-node basis-field "
        "cross energies plus an all-bias energy check, with the core treated "
        "as dielectric."
    )

    capacitance["parasitic_pf"] = capacitance_network["average_adjacent_mutual_pf"]
    capacitance["adjacent_bias_pf"] = capacitance_network["average_adjacent_mutual_pf"]
    capacitance["bias_to_bias_pf"] = capacitance_network["average_adjacent_mutual_pf"]
    comparison_strategy = (
        CAPACITANCE_STRATEGY_REPEAT
        if (
            p.get("solve_strategy") == SOLVE_STRATEGY_END_REPEAT_APPROX
            or bool(p.get("use_repeating_cell_approximation", False))
        )
        else CAPACITANCE_STRATEGY_MIRROR
    )
    if not use_end_repeat:
        comparison_networks: dict[int, dict[str, Any]] = {}
        current_count = int(capacitance_network["node_count"])
        if current_count in {1, 2, 3}:
            comparison_networks[current_count] = capacitance_network
        for comparison_count in (1, 2, 3):
            if comparison_count in comparison_networks:
                continue
            comparison_parameters = axisymmetric_model.normalize_parameters({
                **p,
                "plate_pairs": comparison_count,
                "bias_voltage_v": 1.0,
            })
            comparison_networks[comparison_count] = _full_capacitance_network(
                comparison_parameters,
                modules,
                excitation_strategy=comparison_strategy,
            )
        capacitance["bias_to_ground_comparison"] = _bias_to_ground_method_comparison(
            p,
            modules,
            single_network=comparison_networks[1],
            three_network=comparison_networks[3],
            excitation_strategy=comparison_strategy,
        )
        capacitance["cg_matrix_plate_count_comparison"] = _cg_matrix_plate_count_comparison(
            comparison_networks[2],
            comparison_networks[3],
        )
    admittance = _admittance_from_capacitance(p, capacitance["total_pf"])
    field_fn = _project_field_magnitude(mesh, uh, modules)
    if use_end_repeat:
        repeat_field_fn = _project_field_magnitude(repeat_mesh, repeat_uh, modules)
    sampled = _sample_to_browser_grid(
        mesh,
        field_fn,
        uh,
        p,
        modules,
        mesh_sizes,
        mirror_z_mm=mirror_z_mm,
        repeat_mesh=repeat_mesh,
        repeat_field_fn=repeat_field_fn,
        repeat_potential_fn=repeat_uh,
        repeat_z_bounds_mm=repeat_z_bounds_mm,
        end_z_max_mm=end_z_max_mm,
    )
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
        "potential": sampled["potential"],
        "model": {
            "source": "fenicsx-normalized-model",
            "parameters": p,
            "geometry": axisymmetric_model.geometry_summary(p),
            "boundaryConditions": {
                "biasPotentialV": p["bias_voltage_v"],
                "groundPotentialV": 0.0,
                "fieldModelCoreTreatment": "equipotential bias boundary",
            },
        },
        "adaptive": {
            "enabled": True,
            "type": "gmsh-conforming-fea",
            "note": (
                "End-plus-repeating-interior FEniCSx approximation reconstructed onto the full browser r-z grid."
                if use_end_repeat
                else "Mirror-half FEniCSx/Gmsh solve reconstructed onto the full browser r-z grid."
                if use_mirror_half
                else "Full-stack conforming FEniCSx/Gmsh solve sampled onto the browser r-z grid."
            ),
        },
    }


def _percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round(fraction * (len(ordered) - 1))))
    return float(ordered[index])


def _field_map_comparison(
    reference: dict[str, Any],
    candidate: dict[str, Any],
) -> dict[str, Any]:
    """Compare two sampled dielectric field maps on their shared browser grid."""
    reference_grid = reference["grid"]
    candidate_grid = candidate["grid"]
    if reference_grid["r_coords"] != candidate_grid["r_coords"] or reference_grid["z_coords"] != candidate_grid["z_coords"]:
        raise ValueError("Field validation requires identical sampled r-z coordinates")

    differences: list[float] = []
    reference_values: list[float] = []
    pointwise_relative: list[float] = []
    reference_peak = max(float(reference["max_field_v_per_mm"]), 1e-30)
    for i, row in enumerate(reference["field"]):
        for j, reference_value in enumerate(row):
            if reference_grid["labels"][i][j] != "dielectric":
                continue
            candidate_value = float(candidate["field"][i][j])
            reference_value = float(reference_value)
            difference = abs(candidate_value - reference_value)
            differences.append(difference)
            reference_values.append(reference_value)
            if reference_value >= 0.01 * reference_peak:
                pointwise_relative.append(difference / reference_value)

    rms_difference = math.sqrt(
        sum(value * value for value in differences) / max(1, len(differences))
    )
    peak_difference = abs(
        float(candidate["max_field_v_per_mm"])
        - float(reference["max_field_v_per_mm"])
    )
    reference_location = reference["max_location_mm"]
    candidate_location = candidate["max_location_mm"]
    location_distance = math.hypot(
        float(candidate_location["r"]) - float(reference_location["r"]),
        float(candidate_location["z"]) - float(reference_location["z"]),
    )
    return {
        "dielectric_sample_count": len(differences),
        "reference_peak_v_per_mm": float(reference["max_field_v_per_mm"]),
        "candidate_peak_v_per_mm": float(candidate["max_field_v_per_mm"]),
        "peak_absolute_difference_v_per_mm": peak_difference,
        "peak_relative_difference": peak_difference / reference_peak,
        "peak_location_distance_mm": location_distance,
        "maximum_absolute_map_difference_v_per_mm": max(differences, default=0.0),
        "maximum_map_difference_over_reference_peak": max(differences, default=0.0) / reference_peak,
        "rms_map_difference_v_per_mm": rms_difference,
        "rms_map_difference_over_reference_peak": rms_difference / reference_peak,
        "p99_pointwise_relative_difference_above_1pct_peak": _percentile(pointwise_relative, 0.99),
        "maximum_pointwise_relative_difference_above_1pct_peak": max(pointwise_relative, default=0.0),
    }


def _central_washer_field_comparison(
    reference: dict[str, Any],
    candidate: dict[str, Any],
) -> dict[str, Any]:
    """Compare smooth interior washer samples away from conductor edges."""
    p = reference["parameters"]
    grid = reference["grid"]
    washer_inner = float(p["washer_id_mm"]) / 2.0
    washer_outer = float(p["washer_od_mm"]) / 2.0
    radial_min = washer_inner + 0.3 * (washer_outer - washer_inner)
    radial_max = washer_outer - 0.3 * (washer_outer - washer_inner)
    relative_differences: list[float] = []
    absolute_differences: list[float] = []
    for i, r in enumerate(grid["r_coords"]):
        if not radial_min <= float(r) <= radial_max:
            continue
        for j, _z in enumerate(grid["z_coords"]):
            if grid["labels"][i][j] != "dielectric" or grid["materials"][i][j] != "washer":
                continue
            reference_value = float(reference["field"][i][j])
            candidate_value = float(candidate["field"][i][j])
            if reference_value <= 0.0:
                continue
            difference = abs(candidate_value - reference_value)
            absolute_differences.append(difference)
            relative_differences.append(difference / reference_value)
    return {
        "sample_count": len(relative_differences),
        "median_relative_difference": _percentile(relative_differences, 0.5),
        "p95_relative_difference": _percentile(relative_differences, 0.95),
        "p99_relative_difference": _percentile(relative_differences, 0.99),
        "maximum_relative_difference": max(relative_differences, default=0.0),
        "maximum_absolute_difference_v_per_mm": max(absolute_differences, default=0.0),
    }


def _peak_radial_edge_class(result: dict[str, Any]) -> str:
    p = result["parameters"]
    radius = float(result["max_location_mm"]["r"])
    candidates = {
        "core_outer": float(p["core_od_mm"]) / 2.0,
        "ground_inner": float(p["ground_plate_inner_diameter_mm"]) / 2.0,
        "hv_outer": float(p["hv_plate_od_mm"]) / 2.0,
        "tube_inner": float(p["tube_id_mm"]) / 2.0,
    }
    return min(candidates, key=lambda name: abs(radius - candidates[name]))


def _flat_gap_field_benchmark(result: dict[str, Any]) -> dict[str, Any]:
    """Measure the interior washer field against the parallel-plate result."""
    p = result["parameters"]
    grid = result["grid"]
    washer_inner = float(p["washer_id_mm"]) / 2.0
    washer_outer = float(p["washer_od_mm"]) / 2.0
    radial_min = washer_inner + 0.3 * (washer_outer - washer_inner)
    radial_max = washer_outer - 0.3 * (washer_outer - washer_inner)
    values: list[float] = []
    for i, r in enumerate(grid["r_coords"]):
        if not radial_min <= float(r) <= radial_max:
            continue
        for j, _z in enumerate(grid["z_coords"]):
            if grid["labels"][i][j] == "dielectric" and grid["materials"][i][j] == "washer":
                values.append(float(result["field"][i][j]))
    expected = abs(float(p["bias_voltage_v"])) / float(p["plate_gap_mm"])
    median = _percentile(values, 0.5)
    return {
        "formula": "E = V / gap",
        "bias_voltage_v": float(p["bias_voltage_v"]),
        "plate_gap_mm": float(p["plate_gap_mm"]),
        "expected_v_per_mm": expected,
        "central_washer_sample_count": len(values),
        "sample_median_v_per_mm": median,
        "sample_p10_v_per_mm": _percentile(values, 0.1),
        "sample_p90_v_per_mm": _percentile(values, 0.9),
        "median_over_analytic": median / expected if expected > 0.0 else None,
        "relative_error": abs(median - expected) / expected if expected > 0.0 else None,
        "acceptance_relative_error": 0.03,
        "passes": bool(values) and abs(median - expected) <= 0.03 * expected,
    }


def field_validation_suite(parameters: dict[str, Any]) -> dict[str, Any]:
    """Run field symmetry, flat-gap, and rounded-edge mesh checks."""
    base = axisymmetric_model.normalize_parameters({
        **parameters,
        "plate_pairs": 5,
        "bias_voltage_v": 1000.0,
        "use_repeating_cell_approximation": False,
    })
    strategy_results: dict[str, dict[str, Any]] = {}
    strategy_summaries: dict[str, dict[str, Any]] = {}
    for strategy in ("full_stack", SOLVE_STRATEGY_MIRROR_HALF, SOLVE_STRATEGY_END_REPEAT_APPROX):
        started = time.perf_counter()
        result = solve({**base, "solve_strategy": strategy})
        strategy_results[strategy] = result
        strategy_summaries[strategy] = {
            "elapsed_s": time.perf_counter() - started,
            "max_field_v_per_mm": float(result["max_field_v_per_mm"]),
            "raw_max_field_v_per_mm": float(result["raw_max_field_v_per_mm"]),
            "max_location_mm": result["max_location_mm"],
            "raw_max_location_mm": result["raw_max_location_mm"],
            "field_model_total_pf": float(result["capacitance"]["field_model_total_pf"]),
            "mesh": result["grid"]["mesh"],
        }

    reference = strategy_results["full_stack"]
    mirror_comparison = _field_map_comparison(
        reference,
        strategy_results[SOLVE_STRATEGY_MIRROR_HALF],
    )
    repeat_comparison = _field_map_comparison(
        reference,
        strategy_results[SOLVE_STRATEGY_END_REPEAT_APPROX],
    )
    mirror_interior = _central_washer_field_comparison(
        reference,
        strategy_results[SOLVE_STRATEGY_MIRROR_HALF],
    )
    repeat_interior = _central_washer_field_comparison(
        reference,
        strategy_results[SOLVE_STRATEGY_END_REPEAT_APPROX],
    )
    reference_edge_class = _peak_radial_edge_class(reference)
    mirror_edge_class = _peak_radial_edge_class(
        strategy_results[SOLVE_STRATEGY_MIRROR_HALF]
    )
    repeat_edge_class = _peak_radial_edge_class(
        strategy_results[SOLVE_STRATEGY_END_REPEAT_APPROX]
    )
    mirror_peak_passes = (
        mirror_comparison["peak_relative_difference"] <= 0.005
        or mirror_comparison["peak_absolute_difference_v_per_mm"] <= 10.0
    )
    mirror_map_passes = mirror_interior["p99_relative_difference"] <= 0.01

    mesh_cases: list[dict[str, Any]] = []
    for ratio in (0.4, 0.3, 0.2, 0.15, 0.1):
        started = time.perf_counter()
        result = solve({
            **base,
            "plate_pairs": 1,
            "solve_strategy": SOLVE_STRATEGY_MIRROR_HALF,
            "mesh_edge_radius_ratio": ratio,
        })
        mesh_cases.append({
            "mesh_edge_radius_ratio": ratio,
            "target_fine_mm": result["grid"]["mesh"]["target_fine_mm"],
            "target_coarse_mm": result["grid"]["mesh"]["target_coarse_mm"],
            "supported_peak_v_per_mm": float(result["max_field_v_per_mm"]),
            "raw_peak_v_per_mm": float(result["raw_max_field_v_per_mm"]),
            "field_model_total_pf": float(result["capacitance"]["field_model_total_pf"]),
            "elapsed_s": time.perf_counter() - started,
        })
    previous = mesh_cases[-2]
    finest = mesh_cases[-1]
    peak_delta = abs(finest["supported_peak_v_per_mm"] - previous["supported_peak_v_per_mm"])
    capacitance_delta = abs(finest["field_model_total_pf"] - previous["field_model_total_pf"])
    peak_fraction = peak_delta / max(abs(finest["supported_peak_v_per_mm"]), 1e-30)
    capacitance_fraction = capacitance_delta / max(abs(finest["field_model_total_pf"]), 1e-30)

    flat_gap = _flat_gap_field_benchmark(strategy_results[SOLVE_STRATEGY_MIRROR_HALF])
    return {
        "method": "fenicsx-field-validation-suite",
        "plate_count_for_strategy_comparison": 5,
        "strategy_cases": strategy_summaries,
        "flat_parallel_plate_benchmark": flat_gap,
        "exact_mirror_vs_full": {
            **mirror_comparison,
            "global_dg0_map_is_diagnostic_only": True,
            "central_washer_interior": mirror_interior,
            "reference_peak_radial_edge_class": reference_edge_class,
            "candidate_peak_radial_edge_class": mirror_edge_class,
            "peak_edge_class_matches": reference_edge_class == mirror_edge_class,
            "peak_acceptance": "within 0.5% or 10 V/mm",
            "map_acceptance": "central-washer interior 99th-percentile pointwise field error <= 1%",
            "peak_passes": mirror_peak_passes,
            "map_passes": mirror_map_passes,
            "passes": mirror_peak_passes and mirror_map_passes and reference_edge_class == mirror_edge_class,
        },
        "repeat_approximation_vs_full": {
            **repeat_comparison,
            "global_dg0_map_is_diagnostic_only": True,
            "central_washer_interior": repeat_interior,
            "reference_peak_radial_edge_class": reference_edge_class,
            "candidate_peak_radial_edge_class": repeat_edge_class,
            "peak_edge_class_matches": reference_edge_class == repeat_edge_class,
            "acceptance": "reported as finite-stack approximation error; no exact-symmetry gate",
        },
        "rounded_edge_mesh_convergence": {
            "cases": mesh_cases,
            "finest_two_supported_peak_relative_difference": peak_fraction,
            "finest_two_capacitance_relative_difference": capacitance_fraction,
            "supported_peak_acceptance": "within 2% or 10 V/mm",
            "capacitance_acceptance": "within 1%",
            "peak_passes": peak_fraction <= 0.02 or peak_delta <= 10.0,
            "capacitance_passes": capacitance_fraction <= 0.01,
            "passes": (peak_fraction <= 0.02 or peak_delta <= 10.0) and capacitance_fraction <= 0.01,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect optional FEniCSx backend readiness.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable status.")
    parser.add_argument("--solve-stdin", action="store_true", help="Read parameters as JSON from stdin and print the solve result as JSON.")
    parser.add_argument(
        "--validate-cpar-gap-sweep",
        action="store_true",
        help="Run the Type 61 large-core-gap FEA/analytic Cpar consistency sweep.",
    )
    parser.add_argument(
        "--validate-capacitance-strategies",
        action="store_true",
        help="Compare full, mirror-reused, and repeating Cpar extraction for 2-5 bias plates.",
    )
    parser.add_argument(
        "--validate-cg-strategies",
        action="store_true",
        help="Compare node-resolved Cg under full, mirror, and repeating treatments.",
    )
    parser.add_argument(
        "--validate-cpar-wide-disc-limit",
        action="store_true",
        help="Verify Cpar convergence toward the axial parallel-plate limit.",
    )
    parser.add_argument(
        "--validate-cg-wide-disc-limit",
        action="store_true",
        help="Verify Cg convergence toward the two-washer parallel-plate limit.",
    )
    parser.add_argument(
        "--validate-field-suite",
        action="store_true",
        help="Validate flat-gap field, solve symmetries, and rounded-edge mesh convergence.",
    )
    parser.add_argument(
        "--validate-cg-wide-disc-case",
        type=float,
        default=None,
        help=argparse.SUPPRESS,
    )
    args = parser.parse_args()
    if args.solve_stdin:
        parameters = json.load(sys.stdin)
        print(json.dumps(solve(parameters)))
        return
    if args.validate_cpar_gap_sweep:
        parameters = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        parameters.update({
            "core_material": "type61",
            "ferrite_epsr": 12.0,
            "use_direct_stage_circuit": False,
            "core_od_mm": 2.0,
            "plate_pairs": 3,
            "mesh_edge_radius_ratio": 0.2,
        })
        print(json.dumps(cpar_gap_sweep(parameters), indent=2))
        return
    if args.validate_capacitance_strategies:
        parameters = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        print(json.dumps(capacitance_strategy_sweep(parameters), indent=2))
        return
    if args.validate_cg_strategies:
        parameters = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        print(json.dumps(cg_strategy_sweep(parameters), indent=2))
        return
    if args.validate_cpar_wide_disc_limit:
        parameters = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        print(json.dumps(cpar_limiting_geometry_sweep(parameters), indent=2))
        return
    if args.validate_cg_wide_disc_case is not None:
        parameters = json.load(sys.stdin)
        modules = _import_fenicsx_modules()
        print(json.dumps(
            _cg_limiting_geometry_case(
                parameters,
                args.validate_cg_wide_disc_case,
                modules,
            )
        ))
        return
    if args.validate_cg_wide_disc_limit:
        parameters = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        print(json.dumps(cg_limiting_geometry_sweep(parameters), indent=2))
        return
    if args.validate_field_suite:
        parameters = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        print(json.dumps(field_validation_suite(parameters), indent=2))
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
