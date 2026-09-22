"""Independent full-wave bundling preserves solved provenance and diagnostics."""
import copy
import argparse
import unittest
from pathlib import Path
from unittest.mock import patch

import build_default_bundles as bundles
from axisymmetric_model import normalize_parameters


class FullWaveBundleTests(unittest.TestCase):
    def setUp(self):
        self.result = {
            "status": "completed",
            "parameters": {"plate_pairs": 7, "full_wave_frequencies_hz": [3e8, 1e9],
                           "full_wave_eqs_frequencies_hz": [50, 3e8, 1e9]},
            "samples": [{"frequency_hz": f, "magnitude_db": -100} for f in [3e8, 1e9]],
            "eqs_samples": [{"frequency_hz": f, "magnitude_db": -90} for f in [50, 3e8, 1e9]],
            "all_frequency_points_converged": False,
            "overlap_validation": {"validated": False, "handoff_residual_db": 4},
        }

    def test_keeps_actual_geometry_and_failed_diagnostics(self):
        original = copy.deepcopy(self.result)
        for source in (self.result, {"status": "complete", "result": self.result}):
            with patch.object(bundles, "read_json", return_value=source), patch.object(bundles, "write_bundle") as write:
                bundles.build_full_wave_bundle(Path("result.json"))
                payload = write.call_args.args[2]
                self.assertEqual(payload["settings"], original["parameters"])
                self.assertEqual(payload["result"], original)
        self.assertEqual(self.result, original)

    def test_refuses_incomplete_sweeps(self):
        for samples in ("samples", "eqs_samples"):
            result = copy.deepcopy(self.result)
            result[samples].pop()
            with patch.object(bundles, "read_json", return_value=result), patch.object(bundles, "write_bundle") as write:
                with self.assertRaisesRegex(ValueError, "missing requested frequencies"):
                    bundles.build_full_wave_bundle(Path("result.json"))
                write.assert_not_called()

    def test_refuses_running_or_nonfinite_result(self):
        for changes in ({"status": "running"}, {"parameters": {}},
                        {"samples": [{"frequency_hz": 3e8, "magnitude_db": float("nan")},
                                     {"frequency_hz": 1e9, "magnitude_db": -100}]}):
            with patch.object(bundles, "read_json", return_value={**self.result, **changes}), patch.object(bundles, "write_bundle") as write:
                with self.assertRaises(ValueError):
                    bundles.build_full_wave_bundle(Path("result.json"))
                write.assert_not_called()


class ElectricalBundleTests(unittest.TestCase):
    def test_rejects_spice_from_a_different_capacitance_network(self):
        settings = bundles.read_json(bundles.ROOT / "hardware/geometry/default-parameters.json")
        field = {"parameters": settings, "maxField": 7000,
                 "capacitance": {"capacitance_network": {"node_ground_pf": [30] * 7,
                                   "mutual_pf_matrix": [[0] * 7 for _ in range(7)]}}}
        spice = {"parameters": normalize_parameters(dict(settings)), "circuit": {"geometricShuntCapPfByNode": [30] * 7,
                                                   "mutualCapPfMatrix": [[0] * 7 for _ in range(7)]}}
        args = argparse.Namespace(field_job=Path("field.json"), spice=Path("spice.json"), electrical_only=True)
        with patch.object(bundles, "read_json", side_effect=[settings, field, spice]), patch.object(bundles, "write_bundle") as write:
            bundles.build(args)
            self.assertEqual(write.call_args.args[2]["result"]["parameters"]["plate_pairs"], 7)
        spice["circuit"]["geometricShuntCapPfByNode"][3] = 31
        with patch.object(bundles, "read_json", side_effect=[settings, field, spice]), patch.object(bundles, "write_bundle") as write:
            with self.assertRaisesRegex(ValueError, "SPICE capacitances do not match"):
                bundles.build(args)
            write.assert_not_called()


class GeometryProvenanceTests(unittest.TestCase):
    def test_rejects_field_with_wrong_ground_hole(self):
        settings = bundles.read_json(bundles.ROOT / "hardware/geometry/default-parameters.json")
        field = {"maxField": 7000, "parameters": {**settings, "ground_plate_inner_diameter_mm": settings["ground_plate_inner_diameter_mm"] + 0.2}}
        args = argparse.Namespace(field_job=Path("field.json"), spice=Path("spice.json"), electrical_only=True)
        with patch.object(bundles, "read_json", side_effect=[settings, field, {}]), patch.object(bundles, "write_bundle") as write:
            with self.assertRaisesRegex(ValueError, "ground_plate_inner_diameter_mm"):
                bundles.build(args)
            write.assert_not_called()

    def test_rejects_thermal_with_wrong_shell(self):
        settings = bundles.read_json(bundles.ROOT / "hardware/geometry/default-parameters.json")
        thermal = {"parameters": {**settings, "tube_id_mm": settings["tube_id_mm"] - 2}}
        with patch.object(bundles, "read_json", side_effect=[settings, thermal]), patch.object(bundles, "write_bundle") as write:
            with self.assertRaisesRegex(ValueError, "tube_id_mm"):
                bundles.build_thermal_bundle(Path("thermal.json"))
            write.assert_not_called()


if __name__ == "__main__":
    unittest.main()
