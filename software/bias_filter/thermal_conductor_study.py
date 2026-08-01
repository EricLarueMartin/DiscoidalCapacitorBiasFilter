#!/usr/bin/env python3
"""Compare compliant/CTE-matched conductors and fitted-alumina layouts."""

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
DEFAULT_OUTPUT = ROOT / "simulations" / "thermal" / "conductor-study" / "thermal-conductor-study.json"
PLATE_MATERIALS = ("copper", "aluminum", "titanium_grade_2", "mocu_65_35", "mocu_70_30", "mocu_80_20")
LAYOUTS = (
    ("bulk_epoxy", None),
    ("fitted_alumina", 0.30),
)
CONDUCTIVITY_S_PER_M = {
    "copper": 58.0e6,
    "aluminum": 1.0 / 28.0e-9,
    "titanium_grade_2": 2.2e6,
    "mocu_65_35": 27.0e6,
    "mocu_70_30": 26.0e6,
    "mocu_80_20": 20.0e6,
}
LABELS = {
    "copper": "Copper",
    "aluminum": "1050-O aluminum",
    "titanium_grade_2": "Grade 2 titanium",
    "mocu_65_35": "Mo65Cu35",
    "mocu_70_30": "Mo70Cu30",
    "mocu_80_20": "Mo80Cu20",
}


def _record(
    name: str,
    result: dict[str, Any],
    plate_material: str,
    tube_material: str,
    layout: str,
    bondline_mm: float | None,
) -> dict[str, Any]:
    counts = result["material_cell_counts"]
    dielectric_cells = int(counts["epoxy"]) + int(counts["alumina"])
    plate_properties = result["materials"]["plate"]
    tube_properties = result["materials"]["tube"]
    return {
        "name": name,
        "plate_material": plate_material,
        "plate_label": LABELS[plate_material],
        "tube_material": tube_material,
        "tube_label": LABELS[tube_material],
        "material_layout": layout,
        "bondline_mm": bondline_mm,
        "mesh_size_mm": result["mesh"]["target_size_mm"],
        "mesh_cells": result["mesh"]["cells"],
        "epoxy_cell_fraction_of_epoxy_plus_alumina": (
            float(counts["epoxy"]) / dielectric_cells if dielectric_cells else None
        ),
        "plate_youngs_modulus_gpa": plate_properties["youngs_modulus_mpa"] / 1000.0,
        "plate_poisson_ratio": plate_properties["poisson_ratio"],
        "plate_cte_ppm_per_c": plate_properties["cte_per_c"] * 1e6,
        "plate_conductivity_s_per_m": CONDUCTIVITY_S_PER_M[plate_material],
        "plate_conductivity_fraction_of_copper": CONDUCTIVITY_S_PER_M[plate_material] / CONDUCTIVITY_S_PER_M["copper"],
        "tube_cte_ppm_per_c": tube_properties["cte_per_c"] * 1e6,
        "epoxy_principal_tensile_p95_mpa": result["epoxy_principal_tensile_stress_mpa"]["p95"],
        "epoxy_principal_tensile_p99_mpa": result["epoxy_principal_tensile_stress_mpa"]["p99"],
        "epoxy_principal_tensile_raw_max_mpa": result["epoxy_principal_tensile_stress_mpa"]["raw_max"],
        "epoxy_axial_tensile_p99_mpa": result["epoxy_axial_tensile_stress_mpa"]["p99"],
        "epoxy_rz_shear_p99_abs_mpa": result["epoxy_rz_shear_stress_mpa"]["p99_abs"],
        "epoxy_rz_shear_raw_max_abs_mpa": result["epoxy_rz_shear_stress_mpa"]["raw_max_abs"],
        "constitutive_model": result["assumptions"].get("constitutive_model", "linear_elastic"),
        "plasticity_summary": result["assumptions"].get("plasticity_summary"),
        "material_von_mises_stress_mpa": result.get("material_von_mises_stress_mpa"),
    }


def run_study(output_path: Path) -> dict[str, Any]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    base = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
    base.update({
        "thermal_min_temperature_c": 20.0,
        "thermal_mesh_size_mm": 0.10,
        "_thermal_validation_solve_strategy": "mirror_half",
    })
    cases: list[dict[str, Any]] = []
    plastic_cases: list[dict[str, Any]] = []
    plastic_reference_cases: list[dict[str, Any]] = []

    def run_case(plate_material: str, tube_material: str, layout: str, bondline_mm: float | None) -> None:
        parameters = deepcopy(base)
        parameters["plate_material"] = plate_material
        parameters["tube_material"] = tube_material
        parameters["_thermal_material_layout"] = layout
        if bondline_mm is not None:
            parameters["_thermal_epoxy_bondline_mm"] = bondline_mm
        scope = "plates_only" if tube_material == "copper" and plate_material != "copper" else "plates_and_tube"
        if plate_material == tube_material == "copper":
            scope = "copper_baseline"
        layout_label = "bulk" if layout == "bulk_epoxy" else "fitted_0p30mm"
        name = f"{layout_label}_{plate_material}_{scope}"
        print(f"[thermal conductor study] {name}", file=sys.stderr, flush=True)
        result = thermal_fenicsx_solver.solve(parameters)
        cases.append(_record(name, result, plate_material, tube_material, layout, bondline_mm))

    for layout, bondline_mm in LAYOUTS:
        for plate_material in PLATE_MATERIALS:
            run_case(plate_material, "copper", layout, bondline_mm)
        for material in ("aluminum", "titanium_grade_2", "mocu_70_30"):
            run_case(material, material, layout, bondline_mm)

    for layout, bondline_mm in LAYOUTS:
        parameters = deepcopy(base)
        parameters.update({
            "plate_material": "copper",
            "tube_material": "copper",
            "_thermal_material_layout": layout,
            "_thermal_constitutive_model": "copper_j2_perfect_plastic",
            "_thermal_copper_yield_strength_mpa": 69.0,
            "_thermal_plastic_load_steps": 8,
            "thermal_mesh_size_mm": 0.30,
        })
        if bondline_mm is not None:
            parameters["_thermal_epoxy_bondline_mm"] = bondline_mm
        layout_label = "bulk" if layout == "bulk_epoxy" else "fitted_0p30mm"
        reference_parameters = deepcopy(parameters)
        reference_parameters.pop("_thermal_constitutive_model")
        reference_parameters.pop("_thermal_copper_yield_strength_mpa")
        reference_parameters.pop("_thermal_plastic_load_steps")
        reference_name = f"{layout_label}_copper_linear_plastic_mesh_reference"
        print(f"[thermal conductor study] {reference_name}", file=sys.stderr, flush=True)
        reference_result = thermal_fenicsx_solver.solve(reference_parameters)
        plastic_reference_cases.append(
            _record(reference_name, reference_result, "copper", "copper", layout, bondline_mm)
        )
        name = f"{layout_label}_annealed_copper_j2_perfect_plastic"
        print(f"[thermal conductor study] {name}", file=sys.stderr, flush=True)
        result = thermal_fenicsx_solver.solve(parameters)
        plastic_cases.append(_record(name, result, "copper", "copper", layout, bondline_mm))

    baselines = {
        layout: next(
            case for case in cases
            if case["material_layout"] == layout
            and case["plate_material"] == "copper"
            and case["tube_material"] == "copper"
        )
        for layout, _ in LAYOUTS
    }
    for case in cases:
        baseline = baselines[case["material_layout"]]
        case["principal_p99_ratio_to_same_layout_copper"] = (
            case["epoxy_principal_tensile_p99_mpa"] / baseline["epoxy_principal_tensile_p99_mpa"]
        )
        case["rz_shear_p99_ratio_to_same_layout_copper"] = (
            case["epoxy_rz_shear_p99_abs_mpa"] / baseline["epoxy_rz_shear_p99_abs_mpa"]
        )
    for case in plastic_cases:
        baseline = baselines[case["material_layout"]]
        case["principal_p99_ratio_to_same_layout_copper"] = (
            case["epoxy_principal_tensile_p99_mpa"] / baseline["epoxy_principal_tensile_p99_mpa"]
        )
        case["rz_shear_p99_ratio_to_same_layout_copper"] = (
            case["epoxy_rz_shear_p99_abs_mpa"] / baseline["epoxy_rz_shear_p99_abs_mpa"]
        )
        matched_reference = next(
            reference for reference in plastic_reference_cases
            if reference["material_layout"] == case["material_layout"]
        )
        case["principal_p99_ratio_to_matched_mesh_linear_copper"] = (
            case["epoxy_principal_tensile_p99_mpa"]
            / matched_reference["epoxy_principal_tensile_p99_mpa"]
        )
        case["rz_shear_p99_ratio_to_matched_mesh_linear_copper"] = (
            case["epoxy_rz_shear_p99_abs_mpa"]
            / matched_reference["epoxy_rz_shear_p99_abs_mpa"]
        )

    report = {
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "solver": "axisymmetric-linear-thermoelastic-fenicsx",
        "purpose": "Quantify whether compliant or CTE-matched plate/tube materials and a fitted-alumina thin-epoxy layout reduce epoxy thermal stress.",
        "temperature": {"stress_free_c": 70.0, "evaluated_c": 20.0},
        "geometry_source": "hardware/geometry/default-parameters.json",
        "method": {
            "solve_strategy": "exact axial mirror symmetry",
            "mesh_target_mm": 0.10,
            "interfaces": "perfectly bonded",
            "bulk_layout": "Existing bulk-epoxy solid model.",
            "fitted_layout": "Former bulk-epoxy cells farther than 0.30 mm from every solid profile are reassigned to alumina.",
            "reported_statistics": "P95/P99 cell-center epoxy stresses are comparative metrics; raw corner maxima remain mesh sensitive.",
            "excluded_physics": ["cure shrinkage", "viscoelastic relaxation", "cohesive separation", "voids", "debonding"],
            "linear_case_exclusion": "The 18 primary cases exclude plasticity.",
            "plastic_sensitivity": "Two additional cases use cell-centered associative J2 elastic-perfectly-plastic copper with 69 MPa yield, 8 cooldown increments, no hardening, and a 0.30 mm requested mesh (the fitted-layout bondline cap refines it to 0.15 mm). They are sensitivity cases because a certified purchased-product stress-strain curve is unavailable.",
        },
        "sources": {
            "alumina": "https://www2.coorstek.com/media/4235/advanced-alumina.pdf",
            "mocu": "https://www.hcstarcksolutions.com/wp-content/uploads/PD-7101_1-MoCu-Composites.pdf",
            "titanium": "https://www.robertlaminage.com/en/node/521",
            "epoxy": "https://mgchemicals.com/downloads/tds/tds-9510.pdf",
            "aluminum_1050a": "https://www.hydro.com/globalassets/08-about-hydro/hydro-worldwide/germany/extrusion-germany/alloy-data-sheets/hydro-en-aw-1050a.pdf",
        },
        "cases": cases,
        "plastic_cases": plastic_cases,
        "plastic_reference_cases": plastic_reference_cases,
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
    print(json.dumps({"output": str(args.output.resolve()), "case_count": len(report["cases"])}, indent=2))


if __name__ == "__main__":
    main()
