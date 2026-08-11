"""Build the static default-result bundles from checked-in solver outputs.

Run this after regenerating the default FEniCSx, EQS, SPICE, and MEEP results.
The generated JavaScript lets the GitHub Pages presentation show solved default
results when no simulation backend is available.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def write_bundle(path: Path, variable: str, payload: dict[str, Any]) -> None:
    path.write_text(
        f"window.{variable} = " + json.dumps(payload, separators=(",", ":"), allow_nan=False) + ";\n",
        encoding="utf-8",
    )


def solve_linear(matrix: list[list[complex]], rhs: list[complex]) -> list[complex]:
    augmented = [list(row) + [rhs[index]] for index, row in enumerate(matrix)]
    count = len(augmented)
    for column in range(count):
        pivot = max(range(column, count), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-30:
            raise ValueError("Singular intrinsic ladder matrix")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        scale = augmented[column][column]
        augmented[column] = [value / scale for value in augmented[column]]
        for row in range(count):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [
                augmented[row][index] - factor * augmented[column][index]
                for index in range(count + 1)
            ]
    return [row[-1] for row in augmented]


def symmetric_eigenvalues(matrix: list[list[float]]) -> list[float]:
    """Jacobi eigenvalues for the small real-symmetric admittance matrix."""
    values = [list(map(float, row)) for row in matrix]
    count = len(values)
    for _ in range(50 * count * count):
        p, q = max(
            ((i, j) for i in range(count) for j in range(i + 1, count)),
            key=lambda pair: abs(values[pair[0]][pair[1]]),
            default=(0, 0),
        )
        if p == q or abs(values[p][q]) < 1e-24:
            break
        angle = 0.5 * math.atan2(2.0 * values[p][q], values[q][q] - values[p][p])
        cosine, sine = math.cos(angle), math.sin(angle)
        app, aqq, apq = values[p][p], values[q][q], values[p][q]
        values[p][p] = cosine * cosine * app - 2.0 * sine * cosine * apq + sine * sine * aqq
        values[q][q] = sine * sine * app + 2.0 * sine * cosine * apq + cosine * cosine * aqq
        values[p][q] = values[q][p] = 0.0
        for index in range(count):
            if index in (p, q):
                continue
            aip, aiq = values[index][p], values[index][q]
            values[index][p] = values[p][index] = cosine * aip - sine * aiq
            values[index][q] = values[q][index] = sine * aip + cosine * aiq
    return [values[index][index] for index in range(count)]


def intrinsic_lumped_transfer_db(
    frequency_hz: float,
    maxwell_pf: list[list[float]],
    stage_resistance_ohm: float,
) -> float:
    """Solve the open-circuit bias-plate ladder using G + jwC."""
    count = len(maxwell_pf)
    if count == 1:
        return 0.0
    conductance = [[0.0 for _ in range(count)] for _ in range(count)]
    stage_g = 1.0 / stage_resistance_ohm
    for index in range(count - 1):
        conductance[index][index] += stage_g
        conductance[index + 1][index + 1] += stage_g
        conductance[index][index + 1] -= stage_g
        conductance[index + 1][index] -= stage_g
    omega = 2.0 * math.pi * frequency_hz
    admittance = [
        [conductance[i][j] + 1j * omega * float(maxwell_pf[i][j]) * 1e-12 for j in range(count)]
        for i in range(count)
    ]
    unknown = [row[1:] for row in admittance[1:]]
    rhs = [-row[0] for row in admittance[1:]]
    output = solve_linear(unknown, rhs)[-1]
    return 20.0 * math.log10(max(abs(output), 1e-300))


def mean_adjacent(matrix: list[list[float]], *, negate: bool = False) -> float:
    values = [float(matrix[i][i + 1]) for i in range(len(matrix) - 1)]
    value = sum(values) / len(values) if values else 0.0
    return -value if negate else value


def build(args: argparse.Namespace) -> None:
    settings = read_json(ROOT / "hardware" / "geometry" / "default-parameters.json")
    field_job = read_json(args.field_job)
    field = field_job.get("result", field_job)
    spice = read_json(args.spice)
    eqs = read_json(ROOT / "simulations" / "electromagnetic" / "default-eqs-sweep.json")
    full_wave = read_json(ROOT / "simulations" / "electromagnetic" / "latest-full-wave.json")
    coarse_paths = {
        "0.60": ROOT / "simulations" / "electromagnetic" / "validation" / "default-eqs-1khz-0p60.json",
        "0.45": ROOT / "simulations" / "electromagnetic" / "validation" / "default-eqs-1khz-0p45.json",
    }
    coarse = {key: read_json(path) for key, path in coarse_paths.items()}

    plate_count = int(settings["plate_pairs"])
    if plate_count != 3:
        raise ValueError(f"Static reference currently expects the three-plate default, got {plate_count}")
    for label, payload in (("field", field), ("EQS", eqs), ("full-wave", full_wave)):
        solved_count = int(payload.get("parameters", {}).get("plate_pairs", -1))
        if solved_count != plate_count:
            raise ValueError(f"{label} result has {solved_count} plates; expected {plate_count}")

    network = field["capacitance"]["capacitance_network"]
    maxwell_pf = network["maxwell_pf_matrix"]
    stage_resistance = float(spice["circuit"]["stageResistanceOhm"])
    comparison_samples = []
    bundle_samples = []
    for sample in eqs["samples"]:
        frequency = float(sample["frequency_hz"])
        spice_db = intrinsic_lumped_transfer_db(frequency, maxwell_pf, stage_resistance)
        field_db = float(sample["intrinsic_transfer"]["magnitude_db"])
        comparison_samples.append(
            {
                "frequency_hz": frequency,
                "fenicsx_eqs_db": field_db,
                "spice_db": spice_db,
                "difference_db": field_db - spice_db,
            }
        )
        bundle_samples.append(
            {
                "frequencyHz": frequency,
                "magnitudeDb": float(sample["transfer"]["magnitude_db"]),
                "phaseDeg": float(sample["transfer"]["phase_deg"]),
                "intrinsicFieldDb": field_db,
                "intrinsicSpiceDb": spice_db,
            }
        )

    max_difference = max(abs(row["difference_db"]) for row in comparison_samples)
    intrinsic = {
        "comparison": "intrinsic_open_circuit_vout_over_vin",
        "input": "first bias plate fixed at 1 V",
        "output": "final bias plate measured at infinite impedance",
        "removed": [
            "input series resistor",
            "output series resistor",
            "cable transmission line",
            "lumped cable capacitance",
            "detector capacitance",
            "DC load conductance",
        ],
        "retained": ["interstage resistance", "bias-to-ground capacitance", "bias-to-bias capacitance"],
        "plate_count": plate_count,
        "samples": comparison_samples,
        "maximum_absolute_difference_db": max_difference,
    }
    write_json(ROOT / "simulations" / "electromagnetic" / "intrinsic-spice-eqs-comparison.json", intrinsic)
    eqs_50hz = {**eqs, "samples": [row for row in eqs["samples"] if row["frequency_hz"] == 50.0]}
    write_json(ROOT / "simulations" / "electromagnetic" / "eqs-50hz.json", eqs_50hz)

    highest = eqs["samples"][-1]
    omega = 2.0 * math.pi * float(highest["frequency_hz"])
    eqs_cap_pf = [[float(value) / omega * 1e12 for value in row] for row in highest["y_imag_s"]]
    electrostatic_pf = [[float(value) for value in row] for row in maxwell_pf]
    eqs_diag = sum(eqs_cap_pf[i][i] for i in range(plate_count)) / plate_count
    static_diag = sum(electrostatic_pf[i][i] for i in range(plate_count)) / plate_count
    eqs_mutual = mean_adjacent(eqs_cap_pf, negate=True)
    static_mutual = mean_adjacent(electrostatic_pf, negate=True)
    diag_difference = abs(eqs_diag - static_diag) / static_diag * 100.0
    mutual_difference = abs(eqs_mutual - static_mutual) / static_mutual * 100.0

    reciprocity = max(float(sample["reciprocity_max_abs_s"]) for sample in eqs["samples"])
    min_real_eigenvalue = min(min(symmetric_eigenvalues(sample["y_real_s"])) for sample in eqs["samples"])
    mesh_1khz = {
        key: float(next(row for row in result["samples"] if row["frequency_hz"] == 1000.0)["transfer"]["magnitude_db"])
        for key, result in coarse.items()
    }
    fine_1khz = float(next(row for row in eqs["samples"] if row["frequency_hz"] == 1000.0)["transfer"]["magnitude_db"])
    mesh_1khz["0.30"] = fine_1khz
    mesh_change = max(mesh_1khz.values()) - min(mesh_1khz.values())
    target_g = -1.0 / stage_resistance
    field_g = float(eqs["samples"][0]["y_real_s"][0][1])

    checks = {
        "calibrated_core_resistance": {
            "target_ohm": stage_resistance,
            "field_matrix_off_diagonal_conductance_s": field_g,
            "passed": abs(field_g - target_g) / abs(target_g) < 0.02,
        },
        "reciprocity": {"max_absolute_error_s": reciprocity, "passed": reciprocity <= 1e-15},
        "passivity": {"minimum_real_admittance_eigenvalue_s": min_real_eigenvalue, "passed": min_real_eigenvalue >= -1e-15},
        "electrostatic_limit": {
            "eqs_diagonal_pf": eqs_diag,
            "electrostatic_diagonal_pf": static_diag,
            "diagonal_difference_percent": diag_difference,
            "eqs_mutual_pf": eqs_mutual,
            "electrostatic_mutual_pf": static_mutual,
            "mutual_difference_percent": mutual_difference,
            "passed": diag_difference < 2.0 and mutual_difference < 2.0,
        },
        "mesh_convergence_1khz": {
            "transfer_db_by_mesh_mm": mesh_1khz,
            "maximum_change_db": mesh_change,
            "passed": mesh_change < 0.02,
        },
        "lumped_g_plus_jwc_comparison": {
            "maximum_transfer_difference_db": max_difference,
            "port_condition": "first bias plate driven directly; final bias plate open-circuit; no external source or output network",
            "note": "Difference includes distributed core/dielectric behavior; the reference uses the independent electrostatic Maxwell matrix.",
            "passed": max_difference < 2.0,
        },
    }
    validation = {
        "solver": eqs["solver"],
        "fenicsx_version": eqs.get("fenicsx_version", "0.9.0"),
        "default_sweep": "../default-eqs-sweep.json",
        "plate_count": plate_count,
        "checks": checks,
        "all_implemented_checks_passed": all(check["passed"] for check in checks.values()),
        "not_yet_validated": [
            "3d_melf_geometry",
            "skin_and_proximity_effect",
            "transmission_line_output_above_electrically_short_range",
            "frequency_dependent_dielectric_loss",
            "measured_s_parameter_or_impedance_sweep",
            "field_derived_johnson_noise",
        ],
    }
    write_json(ROOT / "simulations" / "electromagnetic" / "validation" / "validation-summary.json", validation)

    eqs_bundle = {
        "format": "discoidal-capacitor-bias-filter-eqs-sweep",
        "version": 1,
        "settings": settings,
        "solver": eqs["solver"],
        "meshMm": float(eqs["mesh"]["target_size_mm"]),
        "cells": int(eqs["mesh"]["cells"]),
        "excitation": eqs["excitation"],
        "intrinsicExcitation": eqs["intrinsic_excitation"],
        "scope": eqs["scope"],
        "samples": bundle_samples,
        "validation": {
            "maxReciprocityErrorS": reciprocity,
            "minRealAdmittanceEigenvalueS": min_real_eigenvalue,
            "mesh1kHzDb": mesh_1khz,
            "capacitanceComparison": {
                "eqsDiagonalPf": eqs_diag,
                "electrostaticDiagonalPf": static_diag,
                "diagonalDifferencePercent": diag_difference,
                "eqsMutualPf": eqs_mutual,
                "electrostaticMutualPf": static_mutual,
                "mutualDifferencePercent": mutual_difference,
            },
            "maxLumpedComparisonDifferenceDb": max_difference,
        },
    }
    write_bundle(ROOT / "presentations" / "web" / "default-eqs-sweep.js", "DISCOIDAL_DEFAULT_EQS_SWEEP", eqs_bundle)

    field_bundle = {
        "format": "discoidal-capacitor-bias-filter-bundled-field",
        "version": 2,
        "settings": settings,
        "result": field,
        "exactCapacitanceParameters": field["parameters"],
        "spiceLadder": spice,
    }
    write_bundle(ROOT / "presentations" / "web" / "default-fenicsx-field.js", "DISCOIDAL_BUNDLED_DEFAULT_FIELD_RESULT", field_bundle)
    full_wave_bundle = {
        "format": "discoidal-capacitor-bias-filter-full-wave",
        "version": 1,
        "settings": settings,
        "result": full_wave,
    }
    write_bundle(ROOT / "presentations" / "web" / "default-full-wave.js", "DISCOIDAL_DEFAULT_FULL_WAVE", full_wave_bundle)

    print(json.dumps({
        "plate_count": plate_count,
        "node_ground_pf": network["node_ground_pf"],
        "adjacent_mutual_pf": network["adjacent_mutual_pf"],
        "peak_field_kv_per_mm": field["maxField"] / 1000.0,
        "eqs_cells": eqs["mesh"]["cells"],
        "eqs_spice_max_difference_db": max_difference,
        "full_wave_converged": full_wave["all_frequency_points_converged"],
        "validation_passed": validation["all_implemented_checks_passed"],
    }, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--field-job", type=Path, required=True, help="Downloaded field job JSON")
    parser.add_argument("--spice", type=Path, required=True, help="Downloaded matching SPICE response JSON")
    build(parser.parse_args())


if __name__ == "__main__":
    main()
