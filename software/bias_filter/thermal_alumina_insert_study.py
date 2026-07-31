#!/usr/bin/env python3
"""Compare bulk epoxy with fitted-alumina, thin-epoxy thermal layouts."""

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
DEFAULT_OUTPUT = ROOT / "simulations" / "thermal" / "alumina-insert-study" / "thermal-alumina-insert-study.json"
BONDLINE_CASES_MM = (0.50, 0.30, 0.20, 0.10)


def _summary(name: str, result: dict[str, Any], bondline_mm: float | None) -> dict[str, Any]:
    counts = result["material_cell_counts"]
    dielectric_cells = int(counts["epoxy"]) + int(counts["alumina"])
    return {
        "name": name,
        "bondline_mm": bondline_mm,
        "mesh_size_mm": result["mesh"]["target_size_mm"],
        "mesh_cells": result["mesh"]["cells"],
        "epoxy_cell_fraction_of_epoxy_plus_alumina": (
            float(counts["epoxy"]) / dielectric_cells if dielectric_cells else None
        ),
        "epoxy_principal_tensile_p95_mpa": result["epoxy_principal_tensile_stress_mpa"]["p95"],
        "epoxy_principal_tensile_p99_mpa": result["epoxy_principal_tensile_stress_mpa"]["p99"],
        "epoxy_principal_tensile_raw_max_mpa": result["epoxy_principal_tensile_stress_mpa"]["raw_max"],
        "epoxy_rz_shear_p99_abs_mpa": result["epoxy_rz_shear_stress_mpa"]["p99_abs"],
        "epoxy_rz_shear_raw_max_abs_mpa": result["epoxy_rz_shear_stress_mpa"]["raw_max_abs"],
        "epoxy_axial_tensile_p99_mpa": result["epoxy_axial_tensile_stress_mpa"]["p99"],
    }


def run_study(output_path: Path) -> dict[str, Any]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    case_dir = output_path.parent / "cases"
    case_dir.mkdir(parents=True, exist_ok=True)
    base = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
    base["thermal_min_temperature_c"] = 20.0
    base["_thermal_validation_solve_strategy"] = "mirror_half"
    records: list[dict[str, Any]] = []

    def run_case(name: str, parameters: dict[str, Any], bondline_mm: float | None) -> None:
        print(f"[alumina insert study] {name}", file=sys.stderr, flush=True)
        result = thermal_fenicsx_solver.solve(parameters)
        case_path = case_dir / f"{name}.json"
        case_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        record = _summary(name, result, bondline_mm)
        record["case_file"] = str(case_path.relative_to(output_path.parent)).replace("\\", "/")
        records.append(record)

    bulk = deepcopy(base)
    bulk["thermal_mesh_size_mm"] = 0.10
    bulk["_thermal_material_layout"] = "bulk_epoxy"
    run_case("bulk_epoxy_0p10mm_mesh", bulk, None)

    for bondline in BONDLINE_CASES_MM:
        parameters = deepcopy(base)
        parameters["thermal_mesh_size_mm"] = min(0.10, bondline / 2.0)
        parameters["_thermal_material_layout"] = "fitted_alumina"
        parameters["_thermal_epoxy_bondline_mm"] = bondline
        name = f"fitted_alumina_{str(bondline).replace('.', 'p')}mm_bondline"
        run_case(name, parameters, bondline)

    bulk_summary = records[0]
    for record in records[1:]:
        record["principal_p99_ratio_to_bulk_epoxy"] = (
            record["epoxy_principal_tensile_p99_mpa"]
            / bulk_summary["epoxy_principal_tensile_p99_mpa"]
        )
        record["rz_shear_p99_ratio_to_bulk_epoxy"] = (
            record["epoxy_rz_shear_p99_abs_mpa"]
            / bulk_summary["epoxy_rz_shear_p99_abs_mpa"]
        )

    report = {
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "solver": "axisymmetric-linear-thermoelastic-fenicsx",
        "purpose": "Compare the existing bulk epoxy fill with fitted machined alumina occupying former bulk epoxy volume while a thin epoxy clearance remains around each modeled solid component.",
        "temperature": {"stress_free_c": 70.0, "evaluated_c": 20.0},
        "geometry_source": "hardware/geometry/default-parameters.json",
        "method": {
            "bulk_epoxy": "Existing production thermal geometry.",
            "fitted_alumina": "Mesh cells formerly assigned epoxy are reassigned to alumina when their centroid is farther than the specified clearance from every core, washer, plate, and tube profile.",
            "interpretation": "A mesh-resolved comparative fitted-insert model, not final machinable CAD. Perfect bonding is retained and no cohesive failure, cure shrinkage, void, or viscoelastic relaxation is modeled.",
            "reported_statistics": "P95/P99 cell-center epoxy stresses are design comparisons; raw corner peaks remain mesh-sensitive diagnostics.",
        },
        "cases": records,
    }
    output_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = run_study(args.output.resolve())
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
