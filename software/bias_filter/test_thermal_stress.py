from __future__ import annotations

import unittest

from software.bias_filter.axisymmetric_model import DEFAULT_PARAMETERS, load_parameters
from software.bias_filter.thermal_stress import evaluate_default, failure_onset_c, mismatch_strain


class ThermalStressTests(unittest.TestCase):
    def test_mismatch_strain_is_zero_above_reference(self) -> None:
        self.assertEqual(mismatch_strain(74.0, 8.2, 70.0, 80.0), 0.0)

    def test_nominal_alumina_full_restraint_onset(self) -> None:
        onset = failure_onset_c(74.0, 8.2, 70.0, 20.0, 3.0, 0.35, 1.0)
        self.assertAlmostEqual(onset, 4.15, places=1)

    def test_default_alumina_interface_controls(self) -> None:
        result = evaluate_default(load_parameters(DEFAULT_PARAMETERS), 20.0)
        calculation = result["calculation"]
        self.assertEqual(calculation["controlling_interface"], "epoxy-to-alumina washer")
        self.assertGreater(calculation["controlling_evaluation_stress_mpa"], 15.0)
        self.assertGreater(calculation["controlling_strength_margin"], 1.0)


if __name__ == "__main__":
    unittest.main()
