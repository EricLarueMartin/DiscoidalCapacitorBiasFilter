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
from software.bias_filter.thermal_fenicsx_solver import MATERIALS_MPA, THERMAL_CONDUCTOR_MATERIALS


class ThermalStressTests(unittest.TestCase):
    def test_thermal_conductor_presets_include_cte_matched_options(self) -> None:
        self.assertTrue(
            {"copper", "titanium_grade_2", "mocu_65_35", "mocu_70_30", "mocu_80_20"}
            <= THERMAL_CONDUCTOR_MATERIALS
        )
        self.assertAlmostEqual(MATERIALS_MPA["titanium_grade_2"]["cte_per_c"], 8.6e-6)
        self.assertAlmostEqual(MATERIALS_MPA["mocu_70_30"]["cte_per_c"], 8.2e-6)
        self.assertEqual(MATERIALS_MPA["mocu_70_30"]["youngs_modulus_mpa"], 210_000.0)

    def test_mismatch_strain_is_zero_above_reference(self) -> None:
        self.assertEqual(mismatch_strain(74.0, 8.2, 70.0, 80.0), 0.0)

    def test_nominal_alumina_biaxial_strength_crossing(self) -> None:
        onset = biaxial_strength_crossing_c(74.0, 8.2, 70.0, 20.0, 3.0, 0.35, 1.0)
        self.assertAlmostEqual(onset, 4.15, places=1)

    def test_uniform_triaxial_reference_matches_default_scale(self) -> None:
        stress = uniform_triaxial_stress_mpa(0.00329, 3.0, 0.35)
        self.assertAlmostEqual(stress, 32.9, places=1)

    def test_default_alumina_interface_controls(self) -> None:
        result = evaluate_default(load_parameters(DEFAULT_PARAMETERS), 20.0)
        calculation = result["calculation"]
        self.assertEqual(calculation["controlling_interface"], "epoxy-to-alumina washer")
        self.assertGreater(calculation["controlling_evaluation_stress_mpa"], 15.0)
        self.assertGreater(calculation["controlling_strength_margin"], 1.0)
        self.assertAlmostEqual(calculation["uniform_triaxial_reference_stress_mpa"], 32.9, places=1)

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


if __name__ == "__main__":
    unittest.main()
