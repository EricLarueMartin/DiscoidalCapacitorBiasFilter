#!/usr/bin/env python3
"""Run reproducible analytical and numerical checks on the thermal FEA model."""

from __future__ import annotations

import argparse
import json
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from . import axisymmetric_model, thermal_fenicsx_solver
except ImportError:
    import axisymmetric_model  # type: ignore
    import thermal_fenicsx_solver  # type: ignore


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = ROOT / "simulations" / "thermal" / "validation"
MESH_SIZES_MM = [0.60, 0.45, 0.30, 0.20, 0.15, 0.10]

DEFAULT_PROPERTIES = {
    "epoxy": {"youngs_modulus_mpa": 3_000.0, "poisson_ratio": 0.35, "cte_per_c": 74.0e-6},
    "alumina": {"youngs_modulus_mpa": 303_000.0, "poisson_ratio": 0.21, "cte_per_c": 8.2e-6},
    "copper": {"youngs_modulus_mpa": 117_000.0, "poisson_ratio": 0.34, "cte_per_c": 16.9e-6},
    "core": {"youngs_modulus_mpa": 303_000.0, "poisson_ratio": 0.21, "cte_per_c": 8.2e-6},
}


def _relative_error(actual: float, expected: float) -> float:
    scale = max(abs(expected), 1e-30)
    return abs(actual - expected) / scale


def _stress(result: dict[str, Any], statistic: str = "p99") -> float:
    return float(result["epoxy_principal_tensile_stress_mpa"][statistic])


def _case_parameters(
    base: dict[str, Any],
    *,
    temperature_c: float = 20.0,
    mesh_size_mm: float = 0.45,
    strategy: str = "mirror_half",
    boundary_mode: str = "physical",
    materials: dict[str, dict[str, float]] | None = None,
) -> dict[str, Any]:
    parameters = deepcopy(base)
    parameters["thermal_min_temperature_c"] = temperature_c
    parameters["thermal_mesh_size_mm"] = mesh_size_mm
    parameters["_thermal_validation_solve_strategy"] = strategy
    parameters["_thermal_validation_boundary_mode"] = boundary_mode
    if materials is not None:
        parameters["_thermal_validation_materials"] = deepcopy(materials)
    return parameters


def _scaled_properties(scale: float) -> dict[str, dict[str, float]]:
    properties = deepcopy(DEFAULT_PROPERTIES)
    for values in properties.values():
        values["youngs_modulus_mpa"] *= scale
    return properties


def _offset_cte_properties(offset_per_c: float) -> dict[str, dict[str, float]]:
    properties = deepcopy(DEFAULT_PROPERTIES)
    for values in properties.values():
        values["cte_per_c"] += offset_per_c
    return properties


def run_validation(output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    case_dir = output_dir / "cases"
    case_dir.mkdir(parents=True, exist_ok=True)
    base = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
    cases: dict[str, dict[str, Any]] = {}

    def run_case(name: str, description: str, parameters: dict[str, Any]) -> dict[str, Any]:
        print(f"[thermal validation] {name}", file=sys.stderr, flush=True)
        result = thermal_fenicsx_solver.solve(parameters)
        record = {
            "name": name,
            "description": description,
            "parameters": {
                "evaluation_temperature_c": parameters["thermal_min_temperature_c"],
                "thermal_mesh_size_mm": parameters["thermal_mesh_size_mm"],
                "solve_strategy": parameters["_thermal_validation_solve_strategy"],
                "boundary_mode": parameters["_thermal_validation_boundary_mode"],
                "material_overrides": parameters.get("_thermal_validation_materials"),
            },
            "result": result,
        }
        cases[name] = record
        (case_dir / f"{name}.json").write_text(
            json.dumps(record, indent=2) + "\n",
            encoding="utf-8",
        )
        return result

    zero_delta = run_case(
        "zero_temperature_change",
        "The production geometry at the 70 C stress-free reference must have zero thermal stress.",
        _case_parameters(base, temperature_c=70.0, mesh_size_mm=0.60),
    )

    homogeneous = {
        material: {
            "youngs_modulus_mpa": 3_000.0,
            "poisson_ratio": 0.35,
            "cte_per_c": 74.0e-6,
        }
        for material in DEFAULT_PROPERTIES
    }
    homogeneous_free = run_case(
        "homogeneous_free_expansion",
        "Identical material properties and traction-free surfaces must permit free contraction with zero stress.",
        _case_parameters(base, mesh_size_mm=0.60, materials=homogeneous),
    )
    homogeneous_restrained = run_case(
        "homogeneous_fully_restrained",
        "A homogeneous body restrained in all normal directions must reproduce the triaxial closed form.",
        _case_parameters(
            base,
            mesh_size_mm=0.60,
            boundary_mode="fully_restrained",
            materials=homogeneous,
        ),
    )

    default_45 = run_case(
        "temperature_45c",
        "Default bonded stack at half the default temperature drop.",
        _case_parameters(base, temperature_c=45.0, mesh_size_mm=0.45),
    )
    default_20 = run_case(
        "temperature_20c",
        "Default bonded stack at the 50 C temperature drop used by the design screen.",
        _case_parameters(base, temperature_c=20.0, mesh_size_mm=0.45),
    )

    modulus_half = run_case(
        "all_moduli_half",
        "Every Young's modulus is multiplied by 0.5 while Poisson ratios and CTEs are unchanged.",
        _case_parameters(base, mesh_size_mm=0.45, materials=_scaled_properties(0.5)),
    )
    modulus_double = run_case(
        "all_moduli_double",
        "Every Young's modulus is multiplied by 2 while Poisson ratios and CTEs are unchanged.",
        _case_parameters(base, mesh_size_mm=0.45, materials=_scaled_properties(2.0)),
    )
    cte_offset = run_case(
        "common_cte_offset",
        "The same +20 ppm/C offset is added to every CTE; mismatch stress must be invariant.",
        _case_parameters(base, mesh_size_mm=0.45, materials=_offset_cte_properties(20.0e-6)),
    )

    mirror = run_case(
        "symmetry_mirror_half",
        "Production exact-half strategy on the default stack.",
        _case_parameters(base, mesh_size_mm=0.40, strategy="mirror_half"),
    )
    full = run_case(
        "symmetry_full_stack",
        "Full-stack reference with only one axial rigid-body anchor.",
        _case_parameters(base, mesh_size_mm=0.40, strategy="full_stack"),
    )

    mesh_results: list[dict[str, Any]] = []
    for mesh_size in MESH_SIZES_MM:
        name = f"mesh_{str(mesh_size).replace('.', 'p')}_mm"
        result = run_case(
            name,
            f"Default stack mesh-convergence case with {mesh_size:.2f} mm target size.",
            _case_parameters(base, mesh_size_mm=mesh_size),
        )
        mesh_results.append(
            {
                "case": name,
                "mesh_size_mm": mesh_size,
                "cells": int(result["mesh"]["cells"]),
                "p95_mpa": _stress(result, "p95"),
                "p99_mpa": _stress(result, "p99"),
                "raw_max_mpa": _stress(result, "raw_max"),
            }
        )

    delta_t = 70.0 - 20.0
    expected_restrained_mpa = (
        homogeneous["epoxy"]["youngs_modulus_mpa"]
        * homogeneous["epoxy"]["cte_per_c"]
        * delta_t
        / (1.0 - 2.0 * homogeneous["epoxy"]["poisson_ratio"])
    )
    checks = [
        {
            "name": "zero_temperature_change",
            "criterion": "raw maximum tensile stress <= 1e-8 MPa",
            "measured": _stress(zero_delta, "raw_max"),
            "limit": 1.0e-8,
            "passed": _stress(zero_delta, "raw_max") <= 1.0e-8,
        },
        {
            "name": "homogeneous_free_expansion",
            "criterion": "raw maximum tensile stress <= 1e-6 MPa",
            "measured": _stress(homogeneous_free, "raw_max"),
            "limit": 1.0e-6,
            "passed": _stress(homogeneous_free, "raw_max") <= 1.0e-6,
        },
        {
            "name": "homogeneous_fully_restrained",
            "criterion": "P99 agrees with E alpha |delta T| / (1 - 2 nu) within 0.1%",
            "expected_mpa": expected_restrained_mpa,
            "measured_mpa": _stress(homogeneous_restrained),
            "relative_error": _relative_error(_stress(homogeneous_restrained), expected_restrained_mpa),
            "limit": 0.001,
            "passed": _relative_error(_stress(homogeneous_restrained), expected_restrained_mpa) <= 0.001,
        },
        {
            "name": "temperature_linearity",
            "criterion": "P99 at a 50 C drop is twice P99 at a 25 C drop within 0.1%",
            "expected_ratio": 2.0,
            "measured_ratio": _stress(default_20) / _stress(default_45),
            "relative_error": _relative_error(_stress(default_20) / _stress(default_45), 2.0),
            "limit": 0.001,
            "passed": _relative_error(_stress(default_20) / _stress(default_45), 2.0) <= 0.001,
        },
        {
            "name": "common_modulus_scaling",
            "criterion": "P99 scales with a common 0.5x and 2x Young's-modulus multiplier within 0.1%",
            "half_ratio": _stress(modulus_half) / _stress(default_20),
            "double_ratio": _stress(modulus_double) / _stress(default_20),
            "limit": 0.001,
            "passed": (
                _relative_error(_stress(modulus_half) / _stress(default_20), 0.5) <= 0.001
                and _relative_error(_stress(modulus_double) / _stress(default_20), 2.0) <= 0.001
            ),
        },
        {
            "name": "common_cte_offset_invariance",
            "criterion": "Adding the same CTE offset to every material changes P99 by <= 0.1%",
            "reference_mpa": _stress(default_20),
            "offset_mpa": _stress(cte_offset),
            "relative_difference": _relative_error(_stress(cte_offset), _stress(default_20)),
            "limit": 0.001,
            "passed": _relative_error(_stress(cte_offset), _stress(default_20)) <= 0.001,
        },
        {
            "name": "exact_mirror_symmetry",
            "criterion": "Half-stack and full-stack P95/P99 agree within 2%",
            "mirror_p95_mpa": _stress(mirror, "p95"),
            "full_p95_mpa": _stress(full, "p95"),
            "mirror_p99_mpa": _stress(mirror, "p99"),
            "full_p99_mpa": _stress(full, "p99"),
            "p95_relative_difference": _relative_error(_stress(mirror, "p95"), _stress(full, "p95")),
            "p99_relative_difference": _relative_error(_stress(mirror), _stress(full)),
            "mirror_cells": int(mirror["mesh"]["cells"]),
            "full_cells": int(full["mesh"]["cells"]),
            "limit": 0.02,
            "passed": (
                _relative_error(_stress(mirror, "p95"), _stress(full, "p95")) <= 0.02
                and _relative_error(_stress(mirror), _stress(full)) <= 0.02
            ),
        },
    ]

    fine = mesh_results[-1]
    next_fine = mesh_results[-2]
    mesh_check = {
        "name": "mesh_convergence",
        "criterion": "The two finest meshes agree within 1% for P95 and P99; raw maximum is diagnostic only.",
        "coarse_of_pair": next_fine,
        "fine": fine,
        "p95_relative_difference": _relative_error(fine["p95_mpa"], next_fine["p95_mpa"]),
        "p99_relative_difference": _relative_error(fine["p99_mpa"], next_fine["p99_mpa"]),
        "raw_max_relative_difference": _relative_error(fine["raw_max_mpa"], next_fine["raw_max_mpa"]),
        "limit": 0.01,
    }
    mesh_check["passed"] = (
        mesh_check["p95_relative_difference"] <= mesh_check["limit"]
        and mesh_check["p99_relative_difference"] <= mesh_check["limit"]
    )
    checks.append(mesh_check)

    report = {
        "schema_version": 1,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "solver": "axisymmetric-linear-thermoelastic-fenicsx",
        "purpose": "code and numerical verification; not adhesive-fracture validation",
        "analytical_references": {
            "fully_restrained_homogeneous_stress": "E alpha |delta T| / (1 - 2 nu)",
            "temperature_linearity": "linear thermoelastic stress is proportional to |delta T|",
            "common_modulus_scaling": "scaling every Young's modulus leaves displacement unchanged and scales stress",
            "common_cte_offset": "only CTE differences create stress in a traction-free bonded assembly",
        },
        "checks": checks,
        "all_acceptance_checks_passed": all(check["passed"] for check in checks),
        "mesh_convergence": mesh_results,
        "case_files": {
            name: f"cases/{name}.json"
            for name in cases
        },
        "case_summaries": {
            name: {
                "description": record["description"],
                "parameters": record["parameters"],
                "mesh": record["result"]["mesh"],
                "epoxy_principal_tensile_stress_mpa": record["result"][
                    "epoxy_principal_tensile_stress_mpa"
                ],
            }
            for name, record in cases.items()
        },
    }
    (output_dir / "thermal-validation-results.json").write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = run_validation(args.output_dir)
    summary = {
        "output": str(args.output_dir / "thermal-validation-results.json"),
        "all_acceptance_checks_passed": report["all_acceptance_checks_passed"],
        "checks": [
            {"name": check["name"], "passed": check["passed"]}
            for check in report["checks"]
        ],
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
