#!/usr/bin/env python3
"""Axisymmetric linear-thermoelastic FEA for the potted discoidal filter stack.

The electrostatic solver removes conductors from its dielectric mesh. This
solver instead meshes the complete bonded solid assembly and assigns elastic
and thermal properties to epoxy, alumina, copper, and the central core. The
idealized stack is solved from one physical end to its exact axial mirror
plane. Exposed surfaces are traction-free and every material interface is
perfectly bonded.

This is a comparative elastic model, not an adhesive-fracture or cure model.
It excludes cure shrinkage, viscoelastic relaxation, plasticity, cohesive
interfaces, voids, and debonding.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from typing import Any

import axisymmetric_model


REQUIRED_MODULES = ("dolfinx", "ufl", "mpi4py", "petsc4py", "gmsh", "numpy")
REFERENCE_TEMPERATURE_C = 70.0
MATERIAL_TAGS = {
    "epoxy": 1,
    "alumina": 2,
    "copper": 3,
    "core": 4,
}
MATERIALS_MPA = {
    "alumina": {"youngs_modulus_mpa": 303_000.0, "poisson_ratio": 0.21, "cte_per_c": 8.2e-6},
    "copper": {"youngs_modulus_mpa": 117_000.0, "poisson_ratio": 0.34, "cte_per_c": 16.9e-6},
    "ferrite_core": {"youngs_modulus_mpa": 150_000.0, "poisson_ratio": 0.29, "cte_per_c": 10.0e-6},
}


def dependency_status() -> dict[str, Any]:
    missing = [name for name in REQUIRED_MODULES if importlib.util.find_spec(name) is None]
    return {
        "backend": "thermal-fenicsx",
        "ready": not missing,
        "missing": missing,
        "model": "axisymmetric-linear-thermoelastic-perfect-bond",
    }


def _import_modules() -> dict[str, Any]:
    status = dependency_status()
    if not status["ready"]:
        raise RuntimeError(f"Thermal FEniCSx dependencies are missing: {', '.join(status['missing'])}")

    import gmsh  # type: ignore
    import numpy as np  # type: ignore
    import ufl  # type: ignore
    from dolfinx import fem, io, mesh as dmesh  # type: ignore
    from dolfinx.fem import petsc as fem_petsc  # type: ignore
    from mpi4py import MPI  # type: ignore
    from petsc4py import PETSc  # type: ignore

    return {
        "gmsh": gmsh,
        "np": np,
        "ufl": ufl,
        "fem": fem,
        "fem_petsc": fem_petsc,
        "dmesh": dmesh,
        "gmshio": io.gmshio,
        "MPI": MPI,
        "PETSc": PETSc,
    }


def _polygon_surface(gmsh: Any, profile: list[tuple[float, float]], mesh_size_mm: float) -> int:
    points = [gmsh.model.occ.addPoint(float(r), float(z), 0.0, mesh_size_mm) for r, z in profile]
    lines = [
        gmsh.model.occ.addLine(points[index], points[(index + 1) % len(points)])
        for index in range(len(points))
    ]
    loop = gmsh.model.occ.addCurveLoop(lines)
    return gmsh.model.occ.addPlaneSurface([loop])


def _clean_profile(profile: list[tuple[float, float]]) -> list[tuple[float, float]]:
    cleaned: list[tuple[float, float]] = []
    for point in profile:
        if cleaned and math.dist(cleaned[-1], point) <= 1e-9:
            continue
        cleaned.append(point)
    if len(cleaned) > 1 and math.dist(cleaned[0], cleaned[-1]) <= 1e-9:
        cleaned.pop()
    return cleaned


def _mechanical_material(p: dict[str, Any], r_mm: float, z_mm: float) -> str:
    core_radius = float(p["core_od_mm"]) / 2.0
    tube_inner = float(p["tube_id_mm"]) / 2.0
    if r_mm <= core_radius + 1e-7:
        return "core"
    if p.get("include_ground_tube", True) and r_mm >= tube_inner - 1e-7:
        return "copper"
    electrical_kind, _ = axisymmetric_model.classify_point(p, r_mm, z_mm)
    if electrical_kind in {"hv", "ground"}:
        return "copper"
    if axisymmetric_model.material_region(p, r_mm, z_mm) == "washer":
        return "alumina"
    return "epoxy"


def _build_mesh(p: dict[str, Any], modules: dict[str, Any]) -> tuple[Any, Any, dict[str, Any]]:
    gmsh = modules["gmsh"]
    MPI = modules["MPI"]
    mesh_size = max(0.05, min(2.0, float(p.get("thermal_mesh_size_mm", 0.3))))
    length = axisymmetric_model.stack_length_mm(p)
    mirror_z = length / 2.0
    tube_outer = float(p["tube_id_mm"]) / 2.0 + float(p["tube_wall_thickness_mm"])

    gmsh.initialize()
    gmsh.model.add("discoidal_capacitor_bias_filter_thermal_axisymmetric")
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.option.setNumber("Mesh.CharacteristicLengthMin", mesh_size * 0.5)
    gmsh.option.setNumber("Mesh.CharacteristicLengthMax", mesh_size)
    gmsh.option.setNumber("Mesh.Algorithm", 6)

    base = gmsh.model.occ.addRectangle(0.0, 0.0, 0.0, tube_outer, mirror_z)
    tools: list[tuple[int, int]] = []
    for component in axisymmetric_model.component_profiles(p):
        if component["material"] == "epoxy":
            continue
        profile = _clean_profile([(float(r), float(z)) for r, z in component["profile"]])
        if len(profile) < 3:
            continue
        tools.append((2, _polygon_surface(gmsh, profile, mesh_size * 0.5)))

    gmsh.model.occ.synchronize()
    if tools:
        gmsh.model.occ.fragment([(2, base)], tools, removeObject=True, removeTool=True)
        gmsh.model.occ.synchronize()

    surfaces_by_material: dict[str, list[int]] = {name: [] for name in MATERIAL_TAGS}
    for _, surface_tag in gmsh.model.getEntities(2):
        r_mm, z_mm, _ = gmsh.model.occ.getCenterOfMass(2, surface_tag)
        if r_mm < -1e-7 or r_mm > tube_outer + 1e-7 or z_mm < -1e-7 or z_mm > mirror_z + 1e-7:
            continue
        material = _mechanical_material(p, r_mm, min(max(z_mm, 0.0), mirror_z))
        surfaces_by_material[material].append(surface_tag)

    for material, surface_tags in surfaces_by_material.items():
        if not surface_tags:
            continue
        physical_tag = MATERIAL_TAGS[material]
        gmsh.model.addPhysicalGroup(2, surface_tags, physical_tag)
        gmsh.model.setPhysicalName(2, physical_tag, material)

    gmsh.model.mesh.generate(2)
    converted = modules["gmshio"].model_to_mesh(gmsh.model, MPI.COMM_WORLD, 0, gdim=2)
    domain = converted.mesh if hasattr(converted, "mesh") else converted[0]
    cell_tags = converted.cell_tags if hasattr(converted, "cell_tags") else converted[1]
    gmsh.finalize()

    local_cells = domain.topology.index_map(domain.topology.dim).size_local
    global_cells = domain.comm.allreduce(local_cells, op=MPI.SUM)
    local_vertices = domain.topology.index_map(0).size_local
    global_vertices = domain.comm.allreduce(local_vertices, op=MPI.SUM)
    return domain, cell_tags, {
        "type": "gmsh-dolfinx-axisymmetric-solid",
        "target_size_mm": mesh_size,
        "cells": int(global_cells),
        "vertices": int(global_vertices),
        "solved_z_min_mm": 0.0,
        "solved_z_max_mm": mirror_z,
        "full_stack_length_mm": length,
        "symmetry": "exact axial mirror plane",
        "material_surface_counts": {name: len(tags) for name, tags in surfaces_by_material.items()},
    }


def _function_space(fem: Any, domain: Any, element: Any) -> Any:
    if hasattr(fem, "functionspace"):
        return fem.functionspace(domain, element)
    return fem.FunctionSpace(domain, element)


def _material_functions(
    domain: Any,
    cell_tags: Any,
    p: dict[str, Any],
    modules: dict[str, Any],
) -> tuple[Any, Any, Any, dict[str, dict[str, float]]]:
    fem = modules["fem"]
    Q = _function_space(fem, domain, ("DG", 0))
    young = fem.Function(Q)
    poisson = fem.Function(Q)
    cte = fem.Function(Q)

    epoxy = {
        "youngs_modulus_mpa": float(p.get("thermal_epoxy_modulus_gpa", 3.0)) * 1000.0,
        "poisson_ratio": 0.35,
        "cte_per_c": 74.0e-6,
    }
    core_key = "alumina" if str(p.get("core_material", "")).startswith("mmb020") else "ferrite_core"
    properties = {
        "epoxy": epoxy,
        "alumina": MATERIALS_MPA["alumina"],
        "copper": MATERIALS_MPA["copper"],
        "core": MATERIALS_MPA[core_key],
    }
    for material, physical_tag in MATERIAL_TAGS.items():
        cells = cell_tags.find(physical_tag)
        values = properties[material]
        young.x.array[cells] = values["youngs_modulus_mpa"]
        poisson.x.array[cells] = values["poisson_ratio"]
        cte.x.array[cells] = values["cte_per_c"]
    young.x.scatter_forward()
    poisson.x.scatter_forward()
    cte.x.scatter_forward()
    return young, poisson, cte, properties


def _interpolate_dg0(expression: Any, domain: Any, modules: dict[str, Any]) -> Any:
    fem = modules["fem"]
    Q = _function_space(fem, domain, ("DG", 0))
    result = fem.Function(Q)
    interpolation_points = Q.element.interpolation_points()
    result.interpolate(fem.Expression(expression, interpolation_points))
    result.x.scatter_forward()
    return result


def solve(raw_parameters: dict[str, Any]) -> dict[str, Any]:
    p = axisymmetric_model.normalize_parameters(dict(raw_parameters))
    if p.get("washer_material") != "alumina":
        raise ValueError("Thermal FEA currently has mechanical properties only for the alumina washer preset.")
    if p.get("plate_material") != "copper" or p.get("tube_material") != "copper":
        raise ValueError("Thermal FEA currently has mechanical properties only for copper plates and tube.")
    if p.get("epoxy_material") != "mg_9510":
        raise ValueError("Thermal FEA currently has mechanical properties only for the MG Chemicals 9510 epoxy preset.")
    p["thermal_mesh_size_mm"] = max(0.05, min(2.0, float(raw_parameters.get("thermal_mesh_size_mm", 0.3))))
    evaluation_temperature = float(raw_parameters.get("thermal_min_temperature_c", 20.0))
    modules = _import_modules()
    np = modules["np"]
    ufl = modules["ufl"]
    fem = modules["fem"]
    MPI = modules["MPI"]

    domain, cell_tags, mesh_summary = _build_mesh(p, modules)
    V = _function_space(fem, domain, ("Lagrange", 2, (2,)))
    u = ufl.TrialFunction(V)
    v = ufl.TestFunction(V)
    x = ufl.SpatialCoordinate(domain)
    young, poisson, cte, properties = _material_functions(domain, cell_tags, p, modules)
    mu = young / (2.0 * (1.0 + poisson))
    lam = young * poisson / ((1.0 + poisson) * (1.0 - 2.0 * poisson))

    def strain_components(displacement: Any) -> tuple[Any, Any, Any, Any]:
        radial = displacement[0].dx(0)
        hoop = displacement[0] / x[0]
        axial = displacement[1].dx(1)
        shear = 0.5 * (displacement[0].dx(1) + displacement[1].dx(0))
        return radial, hoop, axial, shear

    delta_temperature = evaluation_temperature - REFERENCE_TEMPERATURE_C
    err_u, ett_u, ezz_u, erz_u = strain_components(u)
    err_v, ett_v, ezz_v, erz_v = strain_components(v)
    trace_u = err_u + ett_u + ezz_u
    trace_v = err_v + ett_v + ezz_v
    axisymmetric_weight = 2.0 * math.pi * x[0]
    a_form = (
        2.0 * mu * (err_u * err_v + ett_u * ett_v + ezz_u * ezz_v + 2.0 * erz_u * erz_v)
        + lam * trace_u * trace_v
    ) * axisymmetric_weight * ufl.dx
    l_form = (
        (2.0 * mu + 3.0 * lam) * cte * delta_temperature * trace_v
        * axisymmetric_weight * ufl.dx
    )

    radial_space, _ = V.sub(0).collapse()
    axial_space, _ = V.sub(1).collapse()
    axis_dofs = fem.locate_dofs_geometrical(
        (V.sub(0), radial_space),
        lambda coords: np.isclose(coords[0], 0.0, atol=1e-8),
    )
    mirror_z = axisymmetric_model.stack_length_mm(p) / 2.0
    mirror_dofs = fem.locate_dofs_geometrical(
        (V.sub(1), axial_space),
        lambda coords: np.isclose(coords[1], mirror_z, atol=1e-8),
    )
    zero_radial = fem.Function(radial_space)
    zero_axial = fem.Function(axial_space)
    zero_radial.x.array[:] = 0.0
    zero_axial.x.array[:] = 0.0
    bcs = [
        fem.dirichletbc(zero_radial, axis_dofs, V.sub(0)),
        fem.dirichletbc(zero_axial, mirror_dofs, V.sub(1)),
    ]
    problem = modules["fem_petsc"].LinearProblem(
        a_form,
        l_form,
        bcs=bcs,
        petsc_options={"ksp_type": "preonly", "pc_type": "lu"},
    )
    displacement = problem.solve()
    displacement.x.scatter_forward()

    err, ett, ezz, erz = strain_components(displacement)
    mechanical_trace = err + ett + ezz - 3.0 * cte * delta_temperature
    thermal_strain = cte * delta_temperature
    stress_functions = {
        "rr": _interpolate_dg0(2.0 * mu * (err - thermal_strain) + lam * mechanical_trace, domain, modules),
        "tt": _interpolate_dg0(2.0 * mu * (ett - thermal_strain) + lam * mechanical_trace, domain, modules),
        "zz": _interpolate_dg0(2.0 * mu * (ezz - thermal_strain) + lam * mechanical_trace, domain, modules),
        "rz": _interpolate_dg0(2.0 * mu * erz, domain, modules),
    }

    local_cell_count = domain.topology.index_map(domain.topology.dim).size_local
    local_cells = np.arange(local_cell_count, dtype=np.int32)
    midpoints = modules["dmesh"].compute_midpoints(domain, domain.topology.dim, local_cells)
    epoxy_cells = np.asarray(cell_tags.find(MATERIAL_TAGS["epoxy"]), dtype=np.int32)
    epoxy_cells = epoxy_cells[epoxy_cells < local_cell_count]
    principal_tensile: list[float] = []
    von_mises: list[float] = []
    locations: list[tuple[float, float]] = []
    for cell in epoxy_cells:
        tensor = np.array(
            [
                [stress_functions["rr"].x.array[cell], 0.0, stress_functions["rz"].x.array[cell]],
                [0.0, stress_functions["tt"].x.array[cell], 0.0],
                [stress_functions["rz"].x.array[cell], 0.0, stress_functions["zz"].x.array[cell]],
            ],
            dtype=float,
        )
        eigenvalues = np.linalg.eigvalsh(tensor)
        principal_tensile.append(max(0.0, float(eigenvalues[-1])))
        deviator = tensor - np.trace(tensor) * np.eye(3) / 3.0
        von_mises.append(float(math.sqrt(1.5 * np.sum(deviator * deviator))))
        locations.append((float(midpoints[cell, 0]), float(midpoints[cell, 1])))

    gathered = domain.comm.allgather(
        {
            "principal": principal_tensile,
            "von_mises": von_mises,
            "locations": locations,
        }
    )
    all_principal = np.asarray([value for part in gathered for value in part["principal"]], dtype=float)
    all_von_mises = np.asarray([value for part in gathered for value in part["von_mises"]], dtype=float)
    all_locations = [location for part in gathered for location in part["locations"]]
    if all_principal.size == 0:
        raise RuntimeError("Thermal FEA mesh contains no epoxy cells.")
    raw_index = int(np.argmax(all_principal))
    p99 = float(np.percentile(all_principal, 99.0))
    p95 = float(np.percentile(all_principal, 95.0))
    display_limit = 12_000
    if all_principal.size > display_limit:
        display_indices = np.linspace(0, all_principal.size - 1, display_limit, dtype=int)
    else:
        display_indices = np.arange(all_principal.size, dtype=int)
    display_points = [
        [
            round(all_locations[index][0], 6),
            round(all_locations[index][1], 6),
            round(float(all_principal[index]), 6),
        ]
        for index in display_indices
    ]

    return {
        "status": "ok",
        "source": "thermal-fenicsx",
        "solver": "axisymmetric-linear-thermoelastic-fenicsx",
        "evaluation_temperature_c": evaluation_temperature,
        "reference_temperature_c": REFERENCE_TEMPERATURE_C,
        "temperature_change_c": delta_temperature,
        "epoxy_principal_tensile_stress_mpa": {
            "p95": p95,
            "p99": p99,
            "raw_max": float(all_principal[raw_index]),
            "raw_max_location_mm": {"r": all_locations[raw_index][0], "z": all_locations[raw_index][1]},
        },
        "epoxy_von_mises_stress_mpa": {
            "p99": float(np.percentile(all_von_mises, 99.0)),
            "raw_max": float(np.max(all_von_mises)),
        },
        "epoxy_principal_tensile_field": {
            "point_order": ["r_mm", "z_mm", "stress_mpa"],
            "points": display_points,
            "point_count": len(display_points),
            "source_cell_count": int(all_principal.size),
            "display_scale_max_mpa": p99,
            "solved_half_is_mirrored_for_display": True,
        },
        "mesh": mesh_summary,
        "materials": properties,
        "assumptions": {
            "kinematics": "small-strain axisymmetric linear elasticity",
            "interfaces": "perfectly bonded",
            "external_surfaces": "traction-free",
            "axial_reduction": "exact mirror symmetry about stack center plane",
            "stress_free_temperature_c": REFERENCE_TEMPERATURE_C,
            "cure_shrinkage_included": False,
            "viscoelasticity_included": False,
            "cohesive_or_debond_model_included": False,
            "voids_included": False,
            "reported_design_value": "99th percentile of epoxy cell-center maximum-principal tensile stress",
            "raw_peak_warning": "The raw material-corner peak is mesh-sensitive and is reported only as a diagnostic.",
        },
        "parameters": p,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run axisymmetric thermal-stress FEniCSx analysis.")
    parser.add_argument("--solve-stdin", action="store_true", help="Read parameter JSON from stdin and write result JSON.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.solve_stdin:
        print(json.dumps(dependency_status(), indent=2))
        return
    parameters = json.load(sys.stdin)
    result = solve(parameters)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
