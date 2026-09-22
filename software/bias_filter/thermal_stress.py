"""Radial-and-hoop plane-stress thermal-mismatch baseline for the potted stack.

This closed form assumes equal radial and circumferential stress with zero
axial and r-z shear stress. It is a bulk-stress comparison, not an interface
separation model. The intentionally exposed restraint factor makes the
dominant geometry uncertainty reviewable.
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
    "stycast_2850ft_cat11_epoxy": {
        "cte_ppm_per_c_below_tg": 31.2,
        "tg_c": 80.0,
        "published_tg_c": 115.0,
        "tensile_strength_mpa": 20.0,
        "strength_basis": "provisional bulk tensile proxy; CAT 11 TDS publishes flexural and compressive strength, not tensile strength",
        "cure_shrinkage_percent": 0.2,
        "service_min_c": -55.0,
        "service_max_c": 155.0,
        "cure_schedule": "8 to 16 h at 80 C",
        "source": "https://datasheets.tdx.henkel.com/LOCTITE-STYCAST-2850FT-en_GL.pdf",
    },
    "stycast_2850ft_23lv_epoxy": {
        "cte_ppm_per_c_below_tg": 39.4,
        "tg_c": 45.0,
        "published_tg_c": 40.0,
        "tensile_strength_mpa": 20.0,
        "strength_basis": "provisional bulk tensile proxy; CAT 23LV TDS does not publish tensile strength",
        "cure_shrinkage_percent": 0.3,
        "service_min_c": -55.0,
        "service_max_c": 130.0,
        "cure_schedule": "16 to 24 h at 25 C, followed by a 2 to 4 h post-cure at 45 C",
        "reference_basis": "45 C is modeled as stress-free to bound cooldown from the selected post-cure bake; actual stress lock-in is not known",
        "source": "https://www.mouser.com/datasheet/2/773/STYCAST_2850FT-EN-1760792.pdf",
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
    "ferrite_core": {"cte_ppm_per_c": 10.0, "basis": "engineering preset"},
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
    """Equal radial-and-hoop plane-stress baseline, scaled by restraint."""
    return restraint_factor * modulus_gpa * 1000.0 * mismatch / (1.0 - poisson_ratio)


def uniform_triaxial_stress_mpa(
    mismatch: float,
    modulus_gpa: float,
    poisson_ratio: float,
) -> float:
    """Uniform three-direction restraint reference for the same mismatch."""
    denominator = 1.0 - 2.0 * poisson_ratio
    if denominator <= 0.0:
        raise ValueError("Uniform triaxial reference requires Poisson ratio below 0.5")
    return modulus_gpa * 1000.0 * mismatch / denominator


def biaxial_strength_crossing_c(
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
    epoxy: dict[str, Any],
) -> dict[str, Any]:
    poisson = ASSUMED_EPOXY["poisson_ratio"]
    mismatch = mismatch_strain(
        epoxy["cte_ppm_per_c_below_tg"],
        substrate_cte_ppm,
        epoxy["tg_c"],
        temperature_c,
    )
    stress = restrained_stress_mpa(mismatch, modulus_gpa, poisson, restraint_factor)
    crossing = biaxial_strength_crossing_c(
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
        "biaxial_strength_crossing_c": crossing,
    }


def evaluate_dp270(parameters: dict[str, Any], evaluation_temperature_c: float | None) -> dict[str, Any]:
    try:
        from .thermal_fenicsx_solver import epoxy_thermal_preset
    except ImportError:
        from thermal_fenicsx_solver import epoxy_thermal_preset
    p = dict(parameters)
    if evaluation_temperature_c is not None:
        p["thermal_min_temperature_c"] = evaluation_temperature_c
    preset = epoxy_thermal_preset(p)
    reference = preset["stress_free_temperature_c"]
    temperature = float(p.get("thermal_min_temperature_c", 20))
    modulus = float(p.get("thermal_epoxy_modulus_gpa", 3))
    restraint = float(p.get("thermal_restraint_factor", 1))
    interfaces = []
    for label, alpha, radius in [("epoxy-to-copper tube",16.9,float(p["tube_id_mm"])/2),
                                 ("MELF ceramic-body proxy (coating unknown)",8.2,float(p["core_od_mm"])/2)]:
        strain = abs((preset["cte_per_c"] - alpha*1e-6)*(reference-temperature))
        interfaces.append({"interface":label,"free_mismatch_strain_percent":strain*100,
            "free_radial_mismatch_um":strain*radius*1000,
            "estimated_stress_mpa":restrained_stress_mpa(strain,modulus,.35,restraint),"strength_margin":None})
    controlling=max(interfaces,key=lambda row:row["estimated_stress_mpa"])
    return {"model":"plane-stress mismatch, piecewise DP270 CTE, constant assumed modulus",
        "parameters":p,"default_design":p,"interfaces":interfaces,
        "calculation":{"stress_free_reference_c":reference,"evaluation_temperature_c":temperature,
            "controlling_interface":controlling["interface"],"controlling_evaluation_stress_mpa":controlling["estimated_stress_mpa"],
            "controlling_strength_margin":None},
        "limitations":["40 C cure duration unverified", "No DP270 bulk tensile limit assigned; lap shear is not a tensile criterion", "No cure shrinkage, relaxation or interface failure model"]}


def evaluate_default(parameters: dict[str, Any], evaluation_temperature_c: float | None = None) -> dict[str, Any]:
    if parameters.get("epoxy_material") == "three_m_dp270":
        return evaluate_dp270(parameters, evaluation_temperature_c)
    epoxy_key = {
        "stycast_2850ft_cat11": "stycast_2850ft_cat11_epoxy",
        "stycast_2850ft_23lv": "stycast_2850ft_23lv_epoxy",
    }.get(str(parameters.get("epoxy_material")), "mg_9510_epoxy")
    if parameters.get("epoxy_material") not in {"mg_9510", "stycast_2850ft_cat11", "stycast_2850ft_23lv"}:
        raise ValueError("No thermal closed-form preset for this epoxy")
    epoxy = MATERIALS[epoxy_key]
    if evaluation_temperature_c is None:
        evaluation_temperature_c = float(parameters.get("thermal_min_temperature_c", 20.0))
    nominal_modulus = float(parameters.get("thermal_epoxy_modulus_gpa", ASSUMED_EPOXY["elastic_modulus_nominal_gpa"]))
    poisson = ASSUMED_EPOXY["poisson_ratio"]
    default_restraint = float(parameters.get("thermal_restraint_factor", 1.0))
    tube_radius_mm = float(parameters["tube_id_mm"]) / 2.0
    washer_radius_mm = float(parameters["washer_od_mm"]) / 2.0
    core_radius_mm = float(parameters["core_od_mm"]) / 2.0
    core_is_melf = str(parameters.get("core_material", "")).startswith("mmb020")
    core_cte = MATERIALS["ad_96_alumina"]["cte_ppm_per_c"] if core_is_melf else MATERIALS["ferrite_core"]["cte_ppm_per_c"]
    interfaces = []
    if parameters.get("washer_material") != "epoxy":
        interfaces.append(interface_result("epoxy-to-alumina washer", MATERIALS["ad_96_alumina"]["cte_ppm_per_c"], washer_radius_mm, evaluation_temperature_c, default_restraint, nominal_modulus, epoxy))
    interfaces.append(interface_result("epoxy-to-resistive core", core_cte, core_radius_mm, evaluation_temperature_c, default_restraint, nominal_modulus, epoxy))
    interfaces.append(interface_result("epoxy-to-copper tube", MATERIALS["c110_copper"]["cte_ppm_per_c"], tube_radius_mm, evaluation_temperature_c, default_restraint, nominal_modulus, epoxy))
    controlling = max(interfaces, key=lambda item: item["estimated_stress_mpa"])
    controlling_mismatch = controlling["free_mismatch_strain_percent"] / 100.0
    triaxial_reference_stress = uniform_triaxial_stress_mpa(
        controlling_mismatch,
        nominal_modulus,
        poisson,
    )

    sensitivity_substrate_cte = controlling["substrate_cte_ppm_per_c"]
    modulus_sensitivity = []
    for modulus in ASSUMED_EPOXY["elastic_modulus_range_gpa"]:
        modulus_sensitivity.append({
            "elastic_modulus_gpa": modulus,
            "biaxial_k1_strength_crossing_c": biaxial_strength_crossing_c(
                epoxy["cte_ppm_per_c_below_tg"],
                sensitivity_substrate_cte,
                epoxy["tg_c"],
                epoxy["tensile_strength_mpa"],
                modulus,
                ASSUMED_EPOXY["poisson_ratio"],
                1.0,
            ),
        })

    half_restraint_crossing = biaxial_strength_crossing_c(
        epoxy["cte_ppm_per_c_below_tg"],
        sensitivity_substrate_cte,
        epoxy["tg_c"],
        epoxy["tensile_strength_mpa"],
        nominal_modulus,
        ASSUMED_EPOXY["poisson_ratio"],
        0.5,
    )

    controlling_radius_mm = (
        tube_radius_mm if "tube" in controlling["interface"]
        else core_radius_mm if "core" in controlling["interface"]
        else washer_radius_mm
    )
    room = interface_result(
        controlling["interface"],
        sensitivity_substrate_cte,
        controlling_radius_mm,
        20.0,
        1.0,
        nominal_modulus,
        epoxy,
    )

    return {
        "model": "radial-and-hoop restrained-epoxy thermal-mismatch baseline",
        "model_status": "plane-stress bulk-strength proxy; not a conservative bound or interface-separation prediction",
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
            "reason_for_reference": "The selected cure/reference temperature is treated as stress-free; cure shrinkage and relaxation are not modeled.",
            "evaluation_temperature_c": evaluation_temperature_c,
            "effective_restraint_factor": default_restraint,
            "epoxy_elastic_modulus_gpa": nominal_modulus,
            "equations": {
                "mismatch_strain": "abs(alpha_epoxy - alpha_substrate) * (T_reference - T)",
                "stress": "restraint * E_epoxy * mismatch_strain / (1 - nu_epoxy)",
                "strength_crossing": "plane-stress baseline = selected bulk tensile comparison proxy",
            },
            "interfaces_at_evaluation_temperature": interfaces,
            "controlling_interface": controlling["interface"],
            "controlling_evaluation_stress_mpa": controlling["estimated_stress_mpa"],
            "controlling_strength_margin": controlling["strength_margin"],
            "uniform_triaxial_reference_stress_mpa": triaxial_reference_stress,
            "uniform_triaxial_reference_equation": "E_epoxy * mismatch_strain / (1 - 2 * nu_epoxy)",
            "uniform_triaxial_interpretation": "reference for local three-direction confinement; not a failure criterion or corner-stress bound",
            "biaxial_k1_strength_crossing_c": controlling["biaxial_strength_crossing_c"],
            "biaxial_k05_strength_crossing_c": half_restraint_crossing,
            "biaxial_k1_modulus_sensitivity": modulus_sensitivity,
            "room_temperature_biaxial_k1": room,
            "bulk_material_service_floor_c": epoxy["service_min_c"],
        },
        "interpretation": {
            "bulk_strength_crossing": "The k=1 crossing compares calculated bulk epoxy stress with published bulk tensile strength; it is not a predicted interface-separation temperature.",
            "separation_model_required": "Predicting separation requires cohesive interface laws and epoxy-to-alumina and epoxy-to-copper adhesion strength or fracture-energy data.",
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
