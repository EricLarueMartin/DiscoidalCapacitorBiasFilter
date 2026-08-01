#!/usr/bin/env python3
"""Axisymmetric frequency-domain field admittance and loaded transfer solver.

This is the first geometry-resolved input-to-output frequency calculation.  It
solves the electroquasistatic equation

    div((sigma + j*omega*epsilon) grad(V)) = 0

as a coupled-real FEniCSx problem, so it works with the real PETSc build used
on the Raspberry Pi.  Every bias plate is excited in turn.  The resulting
complex basis fields are combined into the complete bias-node admittance
matrix and then used to calculate both terminated system Vout/Vin and the
intrinsic open-output filter transfer used for the SPICE comparison.

The model includes distributed electric field, displacement current, and the
resistive core.  It deliberately does not yet include magnetic induction,
radiation, skin/proximity effect, or the three-dimensional MELF helix.
"""

from __future__ import annotations

import argparse
import cmath
import json
import math
import time
from pathlib import Path
from typing import Any, Iterable

try:
    from . import axisymmetric_model, thermal_fenicsx_solver
except ImportError:  # Direct execution on the Pi.
    import axisymmetric_model
    import thermal_fenicsx_solver


EPSILON_0_F_PER_M = 8.8541878128e-12
SPEED_OF_LIGHT_M_PER_S = 299_792_458.0
DEFAULT_FREQUENCIES_HZ = (1.0, 10.0, 100.0, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8)


def dependency_status() -> dict[str, Any]:
    status = thermal_fenicsx_solver.dependency_status()
    return {
        "backend": "fenicsx-axisymmetric-eqs-admittance",
        "ready": bool(status["ready"]),
        "missing": list(status["missing"]),
        "formulation": "coupled-real electroquasistatic multiport",
    }


def calibrated_core_conductivity_s_per_m(p: dict[str, Any]) -> tuple[float, str]:
    """Return the continuous-cylinder conductivity used by the axisymmetric model."""
    if p.get("use_direct_stage_circuit", False):
        resistance_ohm = max(1e-12, float(p["melf_stage_resistance_mohm"]) * 1e6)
        length_m = (
            axisymmetric_model.ground_plate_thickness_mm(p) + 2.0 * float(p["plate_gap_mm"])
        ) * 1e-3
        radius_m = max(1e-12, float(p["core_od_mm"]) * 0.5e-3)
        conductivity = length_m / (resistance_ohm * math.pi * radius_m * radius_m)
        return conductivity, "homogeneous cylinder calibrated to entered interstage resistance"
    resistivity_ohm_cm = max(1e-30, float(p["core_volume_resistivity_ohm_cm"]))
    return 100.0 / resistivity_ohm_cm, "converted from entered volume resistivity (ohm-cm)"


def termination_admittance_s(p: dict[str, Any], frequency_hz: float) -> complex:
    voltage = abs(float(p.get("bias_voltage_v", 0.0)))
    load_current_a = max(0.0, float(p.get("load_current_na", 0.0))) * 1e-9
    conductance = load_current_a / voltage if voltage > 0.0 else 0.0
    detector_f = max(0.0, float(p.get("detector_capacitance_pf", 0.0))) * 1e-12
    extra_f = max(0.0, float(p.get("additional_ground_capacitance_pf", 0.0))) * 1e-12
    length_m = max(0.0, float(p.get("load_cable_length_m", 0.0)))
    z0 = max(1e-12, float(p.get("load_cable_impedance_ohm", 50.0)))
    velocity = max(1e-6, float(p.get("load_cable_velocity_factor", 0.66)))
    cable_f = length_m / (z0 * velocity * SPEED_OF_LIGHT_M_PER_S)
    return complex(conductance, 2.0 * math.pi * frequency_hz * (detector_f + extra_f + cable_f))


def solve_complex_dense(matrix: list[list[complex]], rhs: list[complex]) -> list[complex]:
    """Small pivoted Gaussian elimination used only for the terminated nodal system."""
    n = len(rhs)
    a = [list(row) + [rhs[index]] for index, row in enumerate(matrix)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda row: abs(a[row][col]))
        if abs(a[pivot][col]) <= 1e-30:
            raise ValueError("The terminated admittance matrix is singular.")
        a[col], a[pivot] = a[pivot], a[col]
        scale = a[col][col]
        a[col] = [value / scale for value in a[col]]
        for row in range(n):
            if row == col:
                continue
            factor = a[row][col]
            if factor == 0:
                continue
            a[row] = [left - factor * right for left, right in zip(a[row], a[col])]
    return [a[row][-1] for row in range(n)]


def loaded_transfer(y_matrix_s: list[list[complex]], load_s: complex) -> dict[str, Any]:
    """Apply Vin=1 V, leave intermediate ports floating, and terminate Vout."""
    count = len(y_matrix_s)
    if count < 1 or any(len(row) != count for row in y_matrix_s):
        raise ValueError("A nonempty square nodal admittance matrix is required.")
    voltages = [1.0 + 0.0j]
    if count > 1:
        matrix = [[y_matrix_s[row][col] for col in range(1, count)] for row in range(1, count)]
        matrix[-1][-1] += load_s
        rhs = [-y_matrix_s[row][0] for row in range(1, count)]
        voltages.extend(solve_complex_dense(matrix, rhs))
    input_current = sum(y_matrix_s[0][col] * voltages[col] for col in range(count))
    transfer = voltages[-1]
    return {
        "vout_over_vin": {"real": transfer.real, "imag": transfer.imag},
        "magnitude": abs(transfer),
        "magnitude_db": 20.0 * math.log10(abs(transfer)) if abs(transfer) > 0.0 else -math.inf,
        "phase_deg": math.degrees(cmath.phase(transfer)),
        "input_impedance_ohm": (
            {"real": (1.0 / input_current).real, "imag": (1.0 / input_current).imag}
            if abs(input_current) > 0.0 else {"real": math.inf, "imag": 0.0}
        ),
        "node_voltages": [{"real": value.real, "imag": value.imag} for value in voltages],
    }


def _bias_centers(p: dict[str, Any]) -> list[float]:
    return [float(z) for kind, z in axisymmetric_model.plate_centers(p) if kind == "hv"]


def _inside_bias_port(p: dict[str, Any], port: int, r_mm: float, z_mm: float, tolerance: float = 2e-6) -> bool:
    center = _bias_centers(p)[port]
    return axisymmetric_model.rounded_outer_plate(
        max(0.0, r_mm), z_mm, center, 0.0,
        float(p["hv_plate_od_mm"]) / 2.0 + tolerance,
        axisymmetric_model.bias_plate_thickness_mm(p) + 2.0 * tolerance,
        axisymmetric_model.edge_radius_mm(p, "hv"),
    )


def _inside_ground(p: dict[str, Any], r_mm: float, z_mm: float, tolerance: float = 2e-6) -> bool:
    tube_inner = float(p["tube_id_mm"]) / 2.0
    if p.get("include_ground_tube", True) and r_mm >= tube_inner - tolerance:
        return True
    for kind, center in axisymmetric_model.plate_centers(p):
        if kind != "ground":
            continue
        if axisymmetric_model.rounded_inner_plate(
            r_mm, z_mm, float(center),
            max(0.0, float(p["ground_plate_inner_diameter_mm"]) / 2.0 - tolerance),
            tube_inner + tolerance,
            axisymmetric_model.ground_plate_thickness_mm(p) + 2.0 * tolerance,
            axisymmetric_model.edge_radius_mm(p, "ground"),
        ):
            return True
    return False


def _material_coefficients(domain: Any, cell_tags: Any, p: dict[str, Any], modules: dict[str, Any]) -> tuple[Any, Any, dict[str, Any]]:
    fem, np = modules["fem"], modules["np"]
    Q = thermal_fenicsx_solver._function_space(fem, domain, ("DG", 0))
    sigma = fem.Function(Q)
    epsilon = fem.Function(Q)
    core_sigma, core_basis = calibrated_core_conductivity_s_per_m(p)
    epoxy_resistivity = max(1e-30, float(p.get("admittance_epoxy_resistivity_ohm_cm", 2.6e13)))
    values = {
        "epoxy": (100.0 / epoxy_resistivity, float(p["epoxy_epsr"])),
        "alumina": (max(0.0, float(p.get("admittance_alumina_conductivity_s_per_m", 0.0))), float(p["washer_epsr"])),
        "plate": (0.0, 1.0),
        "core": (core_sigma, float(axisymmetric_model.core_capacitance_epsr(p))),
        "tube": (0.0, 1.0),
    }
    for material, tag in thermal_fenicsx_solver.MATERIAL_TAGS.items():
        cells = np.asarray(cell_tags.find(tag), dtype=np.int32)
        sigma.x.array[cells] = values[material][0]
        epsilon.x.array[cells] = EPSILON_0_F_PER_M * values[material][1]
    sigma.x.scatter_forward()
    epsilon.x.scatter_forward()
    return sigma, epsilon, {
        "core_conductivity_s_per_m": core_sigma,
        "core_conductivity_basis": core_basis,
        "epoxy_conductivity_s_per_m": values["epoxy"][0],
        "relative_permittivity": {key: value[1] for key, value in values.items()},
    }


def _solve_basis_fields(domain: Any, p: dict[str, Any], frequency_hz: float, sigma: Any, epsilon: Any, modules: dict[str, Any]) -> list[Any]:
    import basix.ufl  # type: ignore

    fem, ufl, np, PETSc = modules["fem"], modules["ufl"], modules["np"], modules["PETSc"]
    scalar = basix.ufl.element("Lagrange", domain.basix_cell(), 1)
    W = thermal_fenicsx_solver._function_space(fem, domain, basix.ufl.mixed_element([scalar, scalar]))
    trial_r, trial_i = ufl.TrialFunctions(W)
    test_r, test_i = ufl.TestFunctions(W)
    x = ufl.SpatialCoordinate(domain)
    omega = 2.0 * math.pi * frequency_hz
    weight = 2.0 * math.pi * x[0]
    # Multiply the complex equation by -j before splitting it.  This preserves
    # the solution but puts omega*epsilon on both real-block diagonals.  The
    # unrotated split has an exactly zero diagonal for lossless dielectric
    # degrees of freedom and PETSc's sparse LU reports a structural zero pivot.
    a = weight * (
        ufl.inner(omega * epsilon * ufl.grad(trial_r) + sigma * ufl.grad(trial_i), ufl.grad(test_r))
        + ufl.inner(omega * epsilon * ufl.grad(trial_i) - sigma * ufl.grad(trial_r), ufl.grad(test_i))
    ) * ufl.dx
    zero = fem.Constant(domain, PETSc.ScalarType(0.0))
    linear = zero * (test_r + test_i) * ufl.dx
    scalar_r, _ = W.sub(0).collapse()
    scalar_i, _ = W.sub(1).collapse()

    def electrode_marker(points: Any) -> Any:
        return np.asarray([
            _inside_ground(p, float(r), float(z))
            or any(_inside_bias_port(p, port, float(r), float(z)) for port in range(len(_bias_centers(p))))
            for r, z in zip(points[0], points[1])
        ], dtype=bool)

    real_dofs = fem.locate_dofs_geometrical((W.sub(0), scalar_r), electrode_marker)
    imag_dofs = fem.locate_dofs_geometrical((W.sub(1), scalar_i), electrode_marker)
    if len(real_dofs) == 0 or len(imag_dofs) == 0:
        raise RuntimeError("No electrode degrees of freedom were located in the full-stack mesh.")
    fields = []
    for excited in range(len(_bias_centers(p))):
        real_value = fem.Function(scalar_r)
        real_value.interpolate(lambda points, port=excited: np.asarray([
            1.0 if _inside_bias_port(p, port, float(r), float(z)) else 0.0
            for r, z in zip(points[0], points[1])
        ], dtype=PETSc.ScalarType))
        imag_value = fem.Function(scalar_i)
        imag_value.x.array[:] = 0.0
        bcs = [
            fem.dirichletbc(real_value, real_dofs, W.sub(0)),
            fem.dirichletbc(imag_value, imag_dofs, W.sub(1)),
        ]
        problem = modules["fem_petsc"].LinearProblem(
            a, linear, bcs=bcs,
            petsc_options={
                "ksp_type": "preonly",
                "pc_type": "lu",
                "ksp_error_if_not_converged": "true",
            },
        )
        try:
            solution = problem.solve()
        except Exception as error:
            assembled = modules["fem_petsc"].assemble_matrix(fem.form(a), bcs=bcs)
            assembled.assemble()
            diagonal = assembled.getDiagonal().array
            zero_rows = np.flatnonzero(np.abs(diagonal) <= 1e-30)
            raise RuntimeError(
                f"EQS basis solve {excited + 1} failed with {len(zero_rows)} zero diagonal rows; "
                f"original error: {error}"
            ) from error
        solution.x.scatter_forward()
        if not np.all(np.isfinite(solution.x.array)):
            reason = problem.solver.getConvergedReason() if hasattr(problem, "solver") else "unknown"
            raise RuntimeError(
                f"EQS basis solve {excited + 1} produced non-finite values; PETSc reason={reason}. "
                "Check electrode tagging and material coefficient scaling."
            )
        fields.append(solution)
    return fields


def _extract_admittance_matrix(domain: Any, fields: list[Any], frequency_hz: float, sigma: Any, epsilon: Any, modules: dict[str, Any]) -> list[list[complex]]:
    fem, ufl, MPI = modules["fem"], modules["ufl"], modules["MPI"]
    x = ufl.SpatialCoordinate(domain)
    omega = 2.0 * math.pi * frequency_hz
    # Coordinates are millimetres: grad_m = 1000 grad_mm and dV_m3 = 1e-9 dV_mm3.
    weight_si = 1e-3 * 2.0 * math.pi * x[0]
    matrix: list[list[complex]] = []
    for left in fields:
        row = []
        for right in fields:
            dot_real = ufl.inner(ufl.grad(left[0]), ufl.grad(right[0])) - ufl.inner(ufl.grad(left[1]), ufl.grad(right[1]))
            dot_imag = ufl.inner(ufl.grad(left[0]), ufl.grad(right[1])) + ufl.inner(ufl.grad(left[1]), ufl.grad(right[0]))
            real_form = fem.form(weight_si * (sigma * dot_real - omega * epsilon * dot_imag) * ufl.dx)
            imag_form = fem.form(weight_si * (sigma * dot_imag + omega * epsilon * dot_real) * ufl.dx)
            local_real = fem.assemble_scalar(real_form)
            local_imag = fem.assemble_scalar(imag_form)
            row.append(complex(
                domain.comm.allreduce(local_real, op=MPI.SUM),
                domain.comm.allreduce(local_imag, op=MPI.SUM),
            ))
        matrix.append(row)
    return matrix


def solve_sweep(raw_parameters: dict[str, Any], frequencies_hz: Iterable[float] = DEFAULT_FREQUENCIES_HZ) -> dict[str, Any]:
    p = axisymmetric_model.normalize_parameters(dict(raw_parameters))
    p["thermal_mesh_size_mm"] = max(0.05, min(2.0, float(raw_parameters.get("admittance_mesh_size_mm", 0.3))))
    p["_thermal_validation_solve_strategy"] = "full_stack"
    p["_thermal_material_layout"] = str(raw_parameters.get("admittance_material_layout", "bulk_epoxy"))
    modules = thermal_fenicsx_solver._import_modules()
    started = time.perf_counter()
    domain, cell_tags, mesh = thermal_fenicsx_solver._build_mesh(p, modules)
    sigma, epsilon, materials = _material_coefficients(domain, cell_tags, p, modules)
    samples = []
    for frequency in frequencies_hz:
        frequency_hz = float(frequency)
        if frequency_hz <= 0.0:
            raise ValueError("All sweep frequencies must be positive.")
        basis_started = time.perf_counter()
        fields = _solve_basis_fields(domain, p, frequency_hz, sigma, epsilon, modules)
        y_matrix = _extract_admittance_matrix(domain, fields, frequency_hz, sigma, epsilon, modules)
        transfer = loaded_transfer(y_matrix, termination_admittance_s(p, frequency_hz))
        intrinsic_transfer = loaded_transfer(y_matrix, 0.0j)
        samples.append({
            "frequency_hz": frequency_hz,
            "y_real_s": [[value.real for value in row] for row in y_matrix],
            "y_imag_s": [[value.imag for value in row] for row in y_matrix],
            "termination_s": {
                "real": termination_admittance_s(p, frequency_hz).real,
                "imag": termination_admittance_s(p, frequency_hz).imag,
            },
            "transfer": transfer,
            "intrinsic_transfer": intrinsic_transfer,
            "solve_seconds": time.perf_counter() - basis_started,
            "reciprocity_max_abs_s": max(
                abs(y_matrix[i][j] - y_matrix[j][i])
                for i in range(len(y_matrix)) for j in range(len(y_matrix))
            ),
        })
    return {
        "solver": "axisymmetric-electroquasistatic-multiport-fenicsx",
        "status": "completed",
        "scope": "distributed electric field and resistive core; no magnetic induction, radiation, or 3D MELF helix",
        "ports": [f"bias_plate_{index + 1}" for index in range(len(_bias_centers(p)))],
        "excitation": "input bias plate fixed at 1 V; internal plates floating; output terminated",
        "intrinsic_excitation": "first bias plate fixed at 1 V; internal plates floating; final plate open-circuit; no external network",
        "mesh": mesh,
        "materials": materials,
        "parameters": p,
        "samples": samples,
        "elapsed_seconds": time.perf_counter() - started,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parameters", type=Path, default=axisymmetric_model.DEFAULT_PARAMETERS)
    parser.add_argument("--frequencies", nargs="+", type=float, default=list(DEFAULT_FREQUENCIES_HZ))
    parser.add_argument("--mesh-mm", type=float, default=0.3)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--dependency-status", action="store_true")
    args = parser.parse_args()
    if args.dependency_status:
        print(json.dumps(dependency_status(), indent=2))
        return 0
    parameters = axisymmetric_model.load_parameters(args.parameters)
    parameters["admittance_mesh_size_mm"] = args.mesh_mm
    result = solve_sweep(parameters, args.frequencies)
    payload = json.dumps(result, indent=2, allow_nan=False)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
