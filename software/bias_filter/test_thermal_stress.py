from __future__ import annotations

import json
import unittest
from pathlib import Path

from software.bias_filter.axisymmetric_model import DEFAULT_PARAMETERS, load_parameters
from software.bias_filter.thermal_stress import (
    evaluate_default,
    biaxial_strength_crossing_c,
    mismatch_strain,
    uniform_triaxial_stress_mpa,
)
from software.bias_filter.thermal_fenicsx_solver import (
    MATERIALS_MPA,
    THERMAL_CONDUCTOR_MATERIALS,
    selected_constitutive_model,
)


class ThermalStressTests(unittest.TestCase):
    def test_thermal_conductor_presets_include_cte_matched_options(self) -> None:
        self.assertTrue(
            {"copper", "annealed_copper", "aluminum", "titanium_grade_2", "mocu_65_35", "mocu_70_30", "mocu_80_20"}
            <= THERMAL_CONDUCTOR_MATERIALS
        )
        self.assertAlmostEqual(MATERIALS_MPA["titanium_grade_2"]["cte_per_c"], 8.6e-6)
        self.assertAlmostEqual(MATERIALS_MPA["mocu_70_30"]["cte_per_c"], 8.2e-6)
        self.assertEqual(MATERIALS_MPA["annealed_copper"], MATERIALS_MPA["copper"])
        self.assertEqual(MATERIALS_MPA["mocu_70_30"]["youngs_modulus_mpa"], 210_000.0)
        self.assertEqual(MATERIALS_MPA["aluminum"]["youngs_modulus_mpa"], 69_000.0)
        self.assertAlmostEqual(MATERIALS_MPA["aluminum"]["cte_per_c"], 23.55e-6)

    def test_annealed_copper_selects_yielding_model_by_default(self) -> None:
        parameters = load_parameters(DEFAULT_PARAMETERS)
        parameters["plate_material"] = "annealed_copper"
        self.assertEqual(selected_constitutive_model(parameters, parameters), "copper_j2_perfect_plastic")
        parameters["_thermal_constitutive_model"] = "linear_elastic"
        self.assertEqual(selected_constitutive_model(parameters, parameters), "linear_elastic")

    def test_mismatch_strain_is_zero_above_reference(self) -> None:
        self.assertEqual(mismatch_strain(74.0, 8.2, 70.0, 80.0), 0.0)

    def test_nominal_alumina_biaxial_strength_crossing(self) -> None:
        onset = biaxial_strength_crossing_c(74.0, 8.2, 70.0, 20.0, 3.0, 0.35, 1.0)
        self.assertAlmostEqual(onset, 4.15, places=1)

    def test_uniform_triaxial_reference_matches_default_scale(self) -> None:
        stress = uniform_triaxial_stress_mpa(0.00329, 3.0, 0.35)
        self.assertAlmostEqual(stress, 32.9, places=1)

    def test_default_alumina_interface_controls(self) -> None:
        parameters = load_parameters(DEFAULT_PARAMETERS)
        parameters.update({"washer_material": "alumina", "epoxy_material": "mg_9510"})
        result = evaluate_default(parameters, 20.0)
        calculation = result["calculation"]
        self.assertEqual(calculation["controlling_interface"], "epoxy-to-alumina washer")
        self.assertGreater(calculation["controlling_evaluation_stress_mpa"], 15.0)
        self.assertGreater(calculation["controlling_strength_margin"], 1.0)
        self.assertAlmostEqual(calculation["uniform_triaxial_reference_stress_mpa"], 32.9, places=1)

    def test_default_cat23lv_continuous_epoxy_uses_45c_reference_and_alumina_melf(self) -> None:
        result = evaluate_default({**load_parameters(DEFAULT_PARAMETERS), "epoxy_material": "stycast_2850ft_23lv"}, 20.0)
        calculation = result["calculation"]
        self.assertEqual(result["default_design"]["washer_material"], "epoxy")
        self.assertEqual(result["default_design"]["epoxy_material"], "stycast_2850ft_23lv")
        self.assertEqual(calculation["stress_free_reference_c"], 45.0)
        self.assertEqual(calculation["controlling_interface"], "epoxy-to-resistive core")
        self.assertAlmostEqual(calculation["controlling_evaluation_stress_mpa"], 3.6, places=1)

    def test_melf_thermal_preset_is_alumina_substrate(self) -> None:
        self.assertEqual(MATERIALS_MPA["melf_alumina_substrate"], MATERIALS_MPA["alumina"])

    def test_checked_in_fea_verification_campaign_passes(self) -> None:
        root = Path(__file__).resolve().parents[2]
        path = root / "simulations" / "thermal" / "validation" / "thermal-validation-results.json"
        report = json.loads(path.read_text(encoding="utf-8"))
        self.assertTrue(report["all_acceptance_checks_passed"])
        self.assertEqual(len(report["checks"]), 8)
        self.assertTrue(all(check["passed"] for check in report["checks"]))
        self.assertEqual(
            [row["mesh_size_mm"] for row in report["mesh_convergence"]],
            [0.6, 0.45, 0.3, 0.2, 0.15, 0.1],
        )
        for relative_path in report["case_files"].values():
            self.assertTrue((path.parent / relative_path).is_file())

    def test_checked_in_fitted_alumina_study_is_complete(self) -> None:
        root = Path(__file__).resolve().parents[2]
        path = root / "simulations" / "thermal" / "alumina-insert-study" / "thermal-alumina-insert-study.json"
        report = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(len(report["cases"]), 5)
        self.assertEqual([case["bondline_mm"] for case in report["cases"]], [None, 0.5, 0.3, 0.2, 0.1])
        self.assertGreater(report["cases"][0]["epoxy_principal_tensile_p99_mpa"], 0.0)
        self.assertLess(
            report["cases"][-1]["epoxy_cell_fraction_of_epoxy_plus_alumina"],
            report["cases"][0]["epoxy_cell_fraction_of_epoxy_plus_alumina"],
        )
        for case in report["cases"]:
            self.assertTrue((path.parent / case["case_file"]).is_file())
        self.assertTrue((path.parent / "thermal-alumina-insert-comparison.png").is_file())

    def test_checked_in_conductor_layout_study_is_complete(self) -> None:
        root = Path(__file__).resolve().parents[2]
        path = root / "simulations" / "thermal" / "conductor-study" / "thermal-conductor-study.json"
        report = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(report["solver"], "axisymmetric-linear-thermoelastic-fenicsx")
        self.assertEqual(len(report["cases"]), 18)
        self.assertEqual(len(report["plastic_cases"]), 2)
        self.assertEqual(len(report["plastic_reference_cases"]), 2)
        self.assertEqual(report["method"]["mesh_target_mm"], 0.10)
        copper_bulk = next(case for case in report["cases"] if case["name"] == "bulk_copper_copper_baseline")
        titanium_bulk = next(case for case in report["cases"] if case["name"] == "bulk_titanium_grade_2_plates_only")
        copper_fitted = next(case for case in report["cases"] if case["name"] == "fitted_0p30mm_copper_copper_baseline")
        aluminum_bulk = next(case for case in report["cases"] if case["name"] == "bulk_aluminum_plates_only")
        aluminum_all_bulk = next(case for case in report["cases"] if case["name"] == "bulk_aluminum_plates_and_tube")
        self.assertGreater(titanium_bulk["epoxy_principal_tensile_p99_mpa"], copper_bulk["epoxy_principal_tensile_p99_mpa"])
        self.assertGreater(aluminum_bulk["epoxy_principal_tensile_p99_mpa"], 0.0)
        self.assertGreater(aluminum_all_bulk["epoxy_principal_tensile_p99_mpa"], 0.0)
        self.assertTrue(all(case["plasticity_summary"] for case in report["plastic_cases"]))
        validation = json.loads((path.parent / "plasticity-validation.json").read_text(encoding="utf-8"))
        self.assertTrue(validation["checks"]["increment_convergence_passed"])
        self.assertLess(validation["checks"]["p99_tension_relative_change_4_to_8"], 0.001)
        self.assertLessEqual(validation["eight_increment"]["plate_von_mises_raw_max_mpa"], 69.001)
        self.assertLessEqual(validation["eight_increment"]["tube_von_mises_raw_max_mpa"], 69.001)
        self.assertLess(copper_fitted["epoxy_rz_shear_p99_abs_mpa"], copper_bulk["epoxy_rz_shear_p99_abs_mpa"])
        self.assertGreater(copper_fitted["epoxy_principal_tensile_p99_mpa"], copper_bulk["epoxy_principal_tensile_p99_mpa"])


if __name__ == "__main__":
    unittest.main()
