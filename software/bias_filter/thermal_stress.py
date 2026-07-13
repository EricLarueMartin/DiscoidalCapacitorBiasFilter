"""Conservative thermal-mismatch screening for the default potted stack.

This is a closed-form design screen, not a bonded-joint qualification model.
It treats cured epoxy as an equibiaxially restrained layer below its glass
transition temperature and compares the resulting thermal stress with the
manufacturer's cured tensile strength.  The intentionally exposed restraint
factor makes the dominant geometry uncertainty reviewable.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

try:
    from .axisymmetric_model import DEFAULT_PARAMETERS, load_parameters, stack_length_mm
except ImportError:  # Direct script execution from the repository root.
    from axisymmetric_model import DEFAULT_PARAMETERS, load_parameters, stack_length_mm


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "simulations" / "thermal" / "outputs" / "default-thermal-stress.json"

MATERIALS = {
    "mg_9510_epoxy": {
        "cte_ppm_per_c_below_tg": 74.0,
        "tg_c": 70.0,
        "tensile_strength_mpa": 20.0,
        "lap_shear_stainless_mpa": 9.2,
        "lap_shear_aluminum_mpa": 5.8,
        "cure_shrinkage_percent": 3.9,
        "service_min_c": -65.0,
        "service_max_c": 150.0,
        "cure_schedule": "3 h at 80 C (minimum-temperature schedule)",
        "source": "https://mgchemicals.com/downloads/tds/tds-9510.pdf",
    },
    "c110_copper": {
        "cte_ppm_per_c": 16.9,
        "source": "https://alloys.copper.org/alloy/C11000",
    },
    "ad_96_alumina": {
        "cte_ppm_per_c": 8.2,
        "elastic_modulus_gpa": 303.0,
        "poisson_ratio": 0.21,
        "source": "https://www2.coorstek.com/media/4235/advanced-alumina.pdf",
    },
}

# MG Chemicals does not publish these values for 9510.  Preserve the complete
# assumed range instead of silently selecting a generic-epoxy point value.
ASSUMED_EPOXY = {
    "elastic_modulus_nominal_gpa": 3.0,
    "elastic_modulus_range_gpa": [2.0, 4.0],
    "poisson_ratio": 0.35,
    "basis": "engineering assumption for a rigid Shore-D-84 epoxy; measure 9510 coupons before qualification",
}


def mismatch_strain(alpha_epoxy_ppm: float, alpha_substrate_ppm: float, reference_c: float, temperature_c: float) -> float:
    """Return positive free thermal mismatch accumulated below reference_c."""
    return abs(alpha_epoxy_ppm - alpha_substrate_ppm) * 1e-6 * max(0.0, reference_c - temperature_c)


def restrained_stress_mpa(
    mismatch: float,
    modulus_gpa: float,
    poisson_ratio: float,
    restraint_factor: float = 1.0,
) -> float:
    """Equibiaxial plane-stress upper screen, scaled by effective restraint."""
    return restraint_factor * modulus_gpa * 1000.0 * mismatch / (1.0 - poisson_ratio)


def failure_onset_c(
    alpha_epoxy_ppm: float,
    alpha_substrate_ppm: float,
    reference_c: float,
    strength_mpa: float,
    modulus_gpa: float,
    poisson_ratio: float,
    restraint_factor: float = 1.0,
) -> float:
    delta_alpha = abs(alpha_epoxy_ppm - alpha_substrate_ppm) * 1e-6
    if delta_alpha <= 0.0 or restraint_factor <= 0.0:
        return float("-inf")
    allowable_drop_c = strength_mpa * (1.0 - poisson_ratio) / (
        restraint_factor * modulus_gpa * 1000.0 * delta_alpha
    )
    return reference_c - allowable_drop_c


def interface_result(
    name: str,
    substrate_cte_ppm: float,
    radius_mm: float,
    temperature_c: float,
    restraint_factor: float,
    modulus_gpa: float,
) -> dict[str, Any]:
    epoxy = MATERIALS["mg_9510_epoxy"]
    poisson = ASSUMED_EPOXY["poisson_ratio"]
    mismatch = mismatch_strain(
        epoxy["cte_ppm_per_c_below_tg"],
        substrate_cte_ppm,
        epoxy["tg_c"],
        temperature_c,
    )
    stress = restrained_stress_mpa(mismatch, modulus_gpa, poisson, restraint_factor)
    onset = failure_onset_c(
        epoxy["cte_ppm_per_c_below_tg"],
        substrate_cte_ppm,
        epoxy["tg_c"],
        epoxy["tensile_strength_mpa"],
        modulus_gpa,
        poisson,
        restraint_factor,
    )
    return {
        "interface": name,
        "substrate_cte_ppm_per_c": substrate_cte_ppm,
        "delta_cte_ppm_per_c": abs(epoxy["cte_ppm_per_c_below_tg"] - substrate_cte_ppm),
        "temperature_c": temperature_c,
        "temperature_drop_below_tg_c": max(0.0, epoxy["tg_c"] - temperature_c),
        "free_mismatch_strain_percent": 100.0 * mismatch,
        "free_radial_mismatch_um": mismatch * radius_mm * 1000.0,
        "estimated_stress_mpa": stress,
        "strength_margin": epoxy["tensile_strength_mpa"] / stress if stress > 0.0 else None,
        "estimated_failure_onset_c": onset,
    }


def evaluate_default(parameters: dict[str, Any], evaluation_temperature_c: float | None = None) -> dict[str, Any]:
    epoxy = MATERIALS["mg_9510_epoxy"]
    if evaluation_temperature_c is None:
        evaluation_temperature_c = float(parameters.get("thermal_min_temperature_c", 20.0))
    nominal_modulus = float(parameters.get("thermal_epoxy_modulus_gpa", ASSUMED_EPOXY["elastic_modulus_nominal_gpa"]))
    default_restraint = float(parameters.get("thermal_restraint_factor", 1.0))
    tube_radius_mm = float(parameters["tube_id_mm"]) / 2.0
    washer_radius_mm = float(parameters["washer_od_mm"]) / 2.0
    interfaces = [
        interface_result("epoxy-to-alumina washer", MATERIALS["ad_96_alumina"]["cte_ppm_per_c"], washer_radius_mm, evaluation_temperature_c, default_restraint, nominal_modulus),
        interface_result("epoxy-to-copper tube", MATERIALS["c110_copper"]["cte_ppm_per_c"], tube_radius_mm, evaluation_temperature_c, default_restraint, nominal_modulus),
    ]
    controlling = max(interfaces, key=lambda item: item["estimated_stress_mpa"])

    modulus_sensitivity = []
    for modulus in ASSUMED_EPOXY["elastic_modulus_range_gpa"]:
        modulus_sensitivity.append({
            "elastic_modulus_gpa": modulus,
            "full_restraint_failure_onset_c": failure_onset_c(
                epoxy["cte_ppm_per_c_below_tg"],
                MATERIALS["ad_96_alumina"]["cte_ppm_per_c"],
                epoxy["tg_c"],
                epoxy["tensile_strength_mpa"],
                modulus,
                ASSUMED_EPOXY["poisson_ratio"],
                1.0,
            ),
        })

    half_restraint_onset = failure_onset_c(
        epoxy["cte_ppm_per_c_below_tg"],
        MATERIALS["ad_96_alumina"]["cte_ppm_per_c"],
        epoxy["tg_c"],
        epoxy["tensile_strength_mpa"],
        nominal_modulus,
        ASSUMED_EPOXY["poisson_ratio"],
        0.5,
    )

    room = interface_result(
        "epoxy-to-alumina washer",
        MATERIALS["ad_96_alumina"]["cte_ppm_per_c"],
        washer_radius_mm,
        20.0,
        1.0,
        nominal_modulus,
    )

    return {
        "model": "equibiaxial restrained-epoxy thermal-mismatch screen",
        "model_status": "screening only; not a bonded-joint qualification",
        "parameters_file": str(DEFAULT_PARAMETERS.relative_to(ROOT)).replace("\\", "/"),
        "default_design": {
            "epoxy_material": parameters.get("epoxy_material"),
            "washer_material": parameters.get("washer_material"),
            "plate_material": parameters.get("plate_material"),
            "tube_material": parameters.get("tube_material"),
            "core_material": parameters.get("core_material"),
            "tube_id_mm": parameters["tube_id_mm"],
            "washer_od_mm": parameters["washer_od_mm"],
            "washer_id_mm": parameters["washer_id_mm"],
            "washer_thickness_mm": parameters["plate_gap_mm"],
            "stack_length_mm": stack_length_mm(parameters),
        },
        "materials": MATERIALS,
        "assumed_epoxy_mechanics": ASSUMED_EPOXY,
        "calculation": {
            "stress_free_reference_c": epoxy["tg_c"],
            "reason_for_reference": "9510 is cured above Tg; the screen assumes stress relaxes above Tg and freezes in below Tg",
            "evaluation_temperature_c": evaluation_temperature_c,
            "effective_restraint_factor": default_restraint,
            "epoxy_elastic_modulus_gpa": nominal_modulus,
            "equations": {
                "mismatch_strain": "abs(alpha_epoxy - alpha_substrate) * (Tg - T)",
                "stress": "restraint * E_epoxy * mismatch_strain / (1 - nu_epoxy)",
                "failure_onset": "stress = published cured tensile strength",
            },
            "interfaces_at_evaluation_temperature": interfaces,
            "controlling_interface": controlling["interface"],
            "controlling_evaluation_stress_mpa": controlling["estimated_stress_mpa"],
            "controlling_strength_margin": controlling["strength_margin"],
            "conservative_full_restraint_failure_onset_c": controlling["estimated_failure_onset_c"],
            "half_restraint_sensitivity_failure_onset_c": half_restraint_onset,
            "full_restraint_modulus_sensitivity": modulus_sensitivity,
            "room_temperature_full_restraint": room,
            "bulk_material_service_floor_c": epoxy["service_min_c"],
        },
        "interpretation": {
            "cold_limit_estimate": "Use the full-restraint onset as a conservative risk screen, not an operating rating.",
            "interim_transport_guidance": "Until bonded coupons establish a cold rating, use controlled room-temperature transport, preferably at or above 25 C, and avoid unheated or freezing shipment.",
            "why_not_a_rating": "9510 modulus, copper/alumina pull-off strength, interface fracture toughness, and actual strain-relief factor are not published.",
            "cure_shrinkage_handling": "The published 3.9% liquid-to-cured shrinkage is not added as elastic strain because most develops before/around gel and its locked-in fraction is unknown. Residual cure stress can only make the cold screen less favorable.",
            "qualification": "Build representative copper/9510/alumina ring coupons, instrument for debonding, and thermal-cycle in 10 C steps before assigning a subzero operating limit.",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parameters", type=Path, default=DEFAULT_PARAMETERS)
    parser.add_argument("--temperature-c", type=float)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    result = evaluate_default(load_parameters(args.parameters), args.temperature_c)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["calculation"], indent=2))


if __name__ == "__main__":
    main()
