#!/usr/bin/env python3
"""Tests for the staged field-solve backend."""

from __future__ import annotations

import io
import http.client
import importlib
import json
import math
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request
import uuid
import zipfile
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import field_backend
import fenicsx_solver
import axisymmetric_model
import admittance_fenicsx_solver
import full_wave_meep_solver
import spice_ladder


class FieldBackendTests(unittest.TestCase):
    def test_full_wave_solver_imports_as_a_package(self) -> None:
        module = importlib.import_module("software.bias_filter.full_wave_meep_solver")
        self.assertEqual(module.DEFAULT_EQS_FREQUENCIES_HZ[0], 50.0)

    def test_distributed_admittance_plan_is_not_the_old_capacitance_readout(self) -> None:
        plan = fenicsx_solver.distributed_admittance_plan()

        self.assertEqual(plan["status"], "axisymmetric-eqs-implemented")
        self.assertTrue(plan["implementation"].endswith("admittance_fenicsx_solver.py"))
        self.assertEqual(plan["model"], "axisymmetric-electroquasistatic-multiport")
        self.assertTrue(plan["real_scalar_formulation"]["required"])
        self.assertIn("full_complex_nodal_admittance_matrix", plan["required_outputs"])
        self.assertIn("single_resistor_johnson_noise", plan["validation_gates"])
        self.assertIn("SPICE/MNA", plan["primary_comparison"])
        self.assertIn("requires 3D", plan["material_cautions"]["melf"])

    def test_eqs_loaded_transfer_matches_two_node_resistor(self) -> None:
        conductance = 2.0e-6
        load = 3.0e-6
        result = admittance_fenicsx_solver.loaded_transfer(
            [[conductance, -conductance], [-conductance, conductance]],
            complex(load, 0.0),
        )
        self.assertAlmostEqual(result["magnitude"], conductance / (conductance + load))
        self.assertAlmostEqual(result["phase_deg"], 0.0)

    def test_eqs_core_conductivity_calibration_matches_stage_resistance(self) -> None:
        parameters = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        conductivity, basis = admittance_fenicsx_solver.calibrated_core_conductivity_s_per_m(parameters)
        length_m = (
            axisymmetric_model.ground_plate_thickness_mm(parameters)
            + 2.0 * parameters["plate_gap_mm"]
        ) * 1e-3
        area_m2 = math.pi * (parameters["core_od_mm"] * 0.5e-3) ** 2
        recovered_resistance = length_m / (conductivity * area_m2)
        self.assertAlmostEqual(recovered_resistance, parameters["melf_stage_resistance_mohm"] * 1e6)
        self.assertIn("calibrated", basis)

    def test_full_wave_core_sections_use_input_stage_and_output_resistance(self) -> None:
        parameters = axisymmetric_model.normalize_parameters({
            **axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS),
            "plate_pairs": 2,
            "input_series_matches_stage": False,
            "input_series_resistance_mohm": 12.0,
            "output_series_matches_stage": False,
            "output_series_resistance_ohm": 50.0,
        })
        sections = full_wave_meep_solver.resistance_sections_ohm(parameters)

        self.assertEqual([section["role"] for section in sections], ["input", "stage", "output"])
        self.assertEqual(sections[0]["resistance_ohm"], 12e6)
        self.assertEqual(sections[1]["resistance_ohm"], 12e6)
        self.assertEqual(sections[2]["resistance_ohm"], 50.0)
        for section in sections:
            sigma = full_wave_meep_solver.section_conductivity_s_per_m(section, parameters["core_od_mm"])
            area_m2 = math.pi * (parameters["core_od_mm"] * 0.5e-3) ** 2
            recovered = section["length_mm"] * 1e-3 / (sigma * area_m2)
            self.assertAlmostEqual(recovered, section["resistance_ohm"])

    def test_resonance_verification_brackets_coarse_and_model_candidates(self) -> None:
        coarse = [
            {"frequency_hz": 1e9, "magnitude_db": -80.0},
            {"frequency_hz": 3e9, "magnitude_db": -25.0},
            {"frequency_hz": 10e9, "magnitude_db": -55.0},
            {"frequency_hz": 30e9, "magnitude_db": -70.0},
        ]
        candidates = full_wave_meep_solver.resonance_candidates(
            coarse,
            [3.1e9, 12e9],
            1e9,
            30e9,
        )

        self.assertEqual(len(candidates), 2)
        self.assertAlmostEqual(candidates[0]["frequency_hz"], 3e9)
        self.assertIn("coarse_local_maximum", candidates[0]["source"])
        self.assertIn("low_loss_rlc_prediction", candidates[0]["source"])
        plan = full_wave_meep_solver.resonance_refinement_plan(candidates, 1e9, 30e9)
        first_frequencies = plan[0]["frequencies_hz"]
        self.assertEqual(len(first_frequencies), full_wave_meep_solver.RESONANCE_REFINEMENT_POINT_COUNT)
        self.assertIn(3e9, first_frequencies)
        fine_samples = [
            {
                "frequency_hz": frequency,
                "magnitude_db": -20.0 - 80.0 * abs(math.log(frequency / 3e9)),
            }
            for frequency in first_frequencies
        ]
        verified = full_wave_meep_solver.verified_resonances(plan[:1], fine_samples)
        self.assertEqual(len(verified), 1)
        self.assertAlmostEqual(verified[0]["frequency_hz"], 3e9)
        self.assertLess(verified[0]["bracket_hz"][0], 3e9)
        self.assertGreater(verified[0]["bracket_hz"][1], 3e9)

    def test_full_wave_settings_sanitize_resonance_verification(self) -> None:
        parameters = field_backend.sanitized_parameters({
            "full_wave_verify_resonances": True,
            "full_wave_resonance_hints_hz": [3e9, -1, 3e9, 12e9],
        })

        self.assertTrue(parameters["full_wave_verify_resonances"])
        self.assertEqual(parameters["full_wave_resonance_hints_hz"], [3e9, 12e9])

    def test_full_wave_sweep_runs_coarse_then_fine_resonance_pass(self) -> None:
        parameters = {
            **axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS),
            "full_wave_resolution_per_mm": 2.0,
            "full_wave_verify_resonances": True,
            "full_wave_frequencies_hz": [1e9, 3e9, 10e9],
            "full_wave_eqs_frequencies_hz": [1e9],
            "full_wave_resonance_hints_hz": [3e9],
        }
        eqs_result = {
            "samples": [{
                "frequency_hz": 1e9,
                "intrinsic_transfer": {"magnitude_db": -80.0, "phase_deg": 0.0},
                "solve_seconds": 0.1,
                "reciprocity_max_abs_s": 0.0,
            }],
            "mesh": {"cells": 10},
        }

        def fake_frequency(_parameters, frequency, resolution, save_field=False):
            return {
                "frequency_hz": frequency,
                "resolution_per_mm": resolution,
                "magnitude_db": -20.0 - 80.0 * abs(math.log(frequency / 3e9)),
                "convergence": {"converged": True},
                "saved_field": save_field,
            }

        with (
            mock.patch.object(full_wave_meep_solver.admittance_fenicsx_solver, "solve_sweep", return_value=eqs_result),
            mock.patch.object(full_wave_meep_solver, "solve_frequency", side_effect=fake_frequency) as solve_mock,
            mock.patch.object(full_wave_meep_solver, "_import_meep", return_value=object()),
            mock.patch.object(full_wave_meep_solver, "build_geometry", return_value=([], [])),
        ):
            result = full_wave_meep_solver.solve_sweep(parameters)

        self.assertEqual(len(result["coarse_samples"]), 3)
        self.assertEqual(len(result["refined_samples"]), 7)
        self.assertEqual(result["coarse_resolution_per_mm"], 1.0)
        self.assertEqual(result["resolution_per_mm"], 2.0)
        self.assertEqual(len(result["resonance_verification"]["verified_resonances"]), 1)
        self.assertTrue(result["all_frequency_points_converged"])
        self.assertEqual([call.args[2] for call in solve_mock.call_args_list[:3]], [1.0, 1.0, 1.0])
        self.assertTrue(all(call.args[2] == 2.0 for call in solve_mock.call_args_list[3:]))

    def test_checked_in_eqs_sweep_and_validation_are_finite(self) -> None:
        root = Path(__file__).resolve().parents[2]
        result = json.loads(
            (root / "simulations" / "electromagnetic" / "default-eqs-sweep.json").read_text(encoding="utf-8")
        )
        validation = json.loads(
            (root / "simulations" / "electromagnetic" / "validation" / "validation-summary.json").read_text(encoding="utf-8")
        )
        intrinsic = json.loads(
            (root / "simulations" / "electromagnetic" / "intrinsic-spice-eqs-comparison.json").read_text(encoding="utf-8")
        )
        self.assertEqual(result["solver"], "axisymmetric-electroquasistatic-multiport-fenicsx")
        self.assertEqual(len(result["samples"]), 12)
        self.assertEqual(result["ports"], ["bias_plate_1", "bias_plate_2", "bias_plate_3"])
        for sample in result["samples"]:
            self.assertTrue(math.isfinite(sample["transfer"]["magnitude_db"]))
            self.assertTrue(math.isfinite(sample["transfer"]["phase_deg"]))
            self.assertLessEqual(sample["reciprocity_max_abs_s"], 1e-15)
            self.assertEqual(len(sample["y_real_s"]), 3)
            self.assertEqual(len(sample["y_imag_s"]), 3)
        self.assertTrue(validation["all_implemented_checks_passed"])
        self.assertTrue(all(check["passed"] for check in validation["checks"].values()))
        self.assertEqual(intrinsic["output"], "final bias plate measured at infinite impedance")
        self.assertEqual(len(intrinsic["samples"]), 12)
        self.assertLess(intrinsic["maximum_absolute_difference_db"], 2.0)

    def test_static_page_bundles_eqs_result_and_requested_materials(self) -> None:
        root = Path(__file__).resolve().parents[2]
        index = (root / "presentations" / "web" / "index.html").read_text(encoding="utf-8")
        app = (root / "presentations" / "web" / "app.js").read_text(encoding="utf-8")
        eqs = (root / "presentations" / "web" / "default-eqs-sweep.js").read_text(encoding="utf-8")
        full_wave_text = (root / "presentations" / "web" / "default-full-wave.js").read_text(encoding="utf-8")
        self.assertIn('src="default-eqs-sweep.js', index)
        self.assertIn('src="default-full-wave.js', index)
        self.assertIn('value="annealed_copper"', index)
        self.assertIn('value="titanium_grade_2"', index)
        self.assertIn('value="mocu_70_30"', index)
        self.assertIn('<option value="epoxy">Epoxy (same as potting fill)</option>', index)
        self.assertNotIn('value="sux"', index)
        self.assertNotIn('value="en-sc-1840"', index)
        self.assertIn("Full-Field Noise Transmission to First Resonance", index)
        self.assertIn("Reference Design", index)
        self.assertIn("function drawEqsSlide", app)
        self.assertIn("function drawFullWaveSlide", app)
        self.assertIn("function drawSimulationChainSlide", app)
        self.assertIn('id="slideSimulationChainCanvas"', index)
        self.assertIn('id="full_wave_verify_resonances"', index)
        self.assertIn('id="fullWaveActualTime"', index)
        self.assertIn("function fullWaveResonanceHints", app)
        self.assertIn('id="noise_fano_factor"', index)
        self.assertNotIn('id="noise_observed_resolution_fwhm_kev"', index)
        self.assertIn("const GE_FANO_MEASUREMENTS", app)
        self.assertIn("const FANO_TARGET_FRACTION = 0.1", app)
        self.assertNotIn("observedExcessSigmaEv", app)
        full_wave = json.loads(full_wave_text.split("=", 1)[1].strip().rstrip(";"))
        result = full_wave["result"]
        self.assertTrue(result["all_frequency_points_converged"])
        self.assertGreaterEqual(len(result["samples"]), 4)
        for sample in result["samples"]:
            self.assertTrue(sample["convergence"]["converged"])
            self.assertLess(sample["convergence"]["final_residual"], 1e-4)
            self.assertAlmostEqual(sum(sample["outward_flux_fraction"].values()), 1.0)
        bundled_frequencies = [sample["frequency_hz"] for sample in result["samples"]]
        self.assertTrue(set(full_wave_meep_solver.DEFAULT_FREQUENCIES_HZ).issubset(bundled_frequencies))
        eqs_frequencies = {sample["frequency_hz"] for sample in result["eqs_samples"]}
        self.assertGreaterEqual(len(eqs_frequencies.intersection(bundled_frequencies)), 2)
        overlap = result["overlap_validation"]
        self.assertTrue(overlap["validated"])
        self.assertLess(abs(overlap["handoff_residual_db"]), overlap["tolerance_db"])
        verified = result["resonance_verification"]["verified_resonances"]
        self.assertGreaterEqual(len(verified), 1)
        self.assertLess(verified[0]["bracket_hz"][0], verified[0]["frequency_hz"])
        self.assertGreater(verified[0]["bracket_hz"][1], verified[0]["frequency_hz"])
        self.assertEqual(result["eqs_samples"][0]["frequency_hz"], 50.0)
        self.assertGreaterEqual(result["eqs_samples"][-1]["frequency_hz"], 100e6)
        self.assertEqual(full_wave_meep_solver.DEFAULT_FREQUENCIES_HZ, (300e6, 1e9, 3e9, 10e9, 30e9))
        self.assertEqual(full_wave_meep_solver.DEFAULT_EQS_FREQUENCIES_HZ[-1], 1e9)
        self.assertIn("function drawIntrinsicComparisonSlide", app)
        self.assertNotIn('id="slideIntrinsicSpiceCanvas"', index)
        self.assertIn("Intrinsic filter, EM ports", app)
        self.assertIn("DISCOIDAL_DEFAULT_EQS_SWEEP", eqs)

    def test_french_and_german_cover_current_main_model_slides(self) -> None:
        root = Path(__file__).resolve().parents[2]
        locale_root = root / "presentations" / "web" / "locales"
        required_slides = {
            "What Is Modeled",
            "Bias Noise After the Energy Filter",
            "From Full-Geometry FEA to SPICE",
            "Reference Design",
            "Washer candidate: 6.6 mm ID, 20 mm OD, 1.5 mm thick alumina.",
            "Potting baseline: Stycast 2850FT with CAT 23LV, vacuum-degassed and cured 16–24 hours at room temperature.",
            "Using the Modeler",
            "Build the physical stack",
            "Or enter component R and C",
            "Use the right level of confidence",
            "Entered R and C are mapped to effective material properties, much like modeling the gap as a resistive and capacitive medium. Useful for sensitivity studies—not component-level peak-field qualification.",
            "Discrete HV Capacitors Stay a Backup",
            "Partial Discharge Is a System Property",
            "Dominant PD concern",
            "Use only with component-level DC and PD qualification.",
            "Thin Epoxy Reduces Volume, Not Necessarily Local Stress",
            "Soft Metal Helps Only the Bulk-Epoxy Layout",
            "CTE-Matched Metal Trades Tension for Lower Shear",
            "P99 tension",
            "All values are fitted-alumina P99 stresses in MPa. Green is lower and red is higher than the copper baseline; the plastic case uses its matched-mesh linear-copper reference. Perfect bonding is assumed.",
            "Bias-to-Ground Capacitance from FEA",
            "Bias-to-Bias Parasitic Capacitance from FEA",
            "Electroquasistatic FEA Checks the Distributed RC Model",
            "Full-Field Noise Transmission to First Resonance",
            "From Damped Resonances to Field-Derived Transfer",
        }
        required_canvas = {
            "Intrinsic coupled-stage electromagnetic response",
            "Predicted loaded peaks",
            "First verified mode",
            "RLC-predicted loaded fpeak",
            "Shared radial envelope",
            "Fixed two-pair simulation",
            "Ground tube ID 26.0 mm",
            "Node shunt C",
            "The washer and copper geometry remain fixed. Only the central resistive insert and its termination method change.",
            "Stress (MPa)",
            "Epoxy cell fraction",
            "Electrical conductivity relative to copper",
            "18 elastic + 2 matched references + 2 J2 sensitivity cases, generated 2026-08-01",
        }
        required_text = {
            "Contents",
            "Filter study",
            "Sections",
            "Main presentation",
            "Models & FEA results",
            "Validation & limiting cases",
            "Engineering decisions",
            "Noise",
            "Field FEA",
            "Detector noise",
            "ADC sampling frequency",
            "Predicted bias noise",
            "Electrostatic solver",
            "Peak FEA process memory",
            "Full-wave electromagnetic solver",
            "Verify resonances with fine solves",
            "Actual solve time",
            "FEA epoxy tensile P99",
            "Bulk-strength proxy crossing",
        }
        required_content = {
            "Full-wave model scope",
            "The MEEP branch includes only rotationally symmetric m = 0 fields. Leads, a helical MELF film, and asymmetric antenna or cavity modes require a later 3D solve.",
            "What the repeating-cell approximation solves",
            "Interior half-cell: the center of that first bias plate through the center of the next interior ground plate—the second ground plate when the end cap is counted.",
            "Calculation method",
            "k is the fraction of radial and circumferential (hoop) mismatch strain prevented in the closed-form approximation. It assumes σrr = σθθ and σzz = σrz = 0. It is not a prescribed surface shift, and it does not control the FEA.",
            "9510 TDS · CoorsTek alumina · C110 copper",
        }
        required_tooltips = {
            "noise_sample_rate_msps",
            "noise_waveform_samples",
            "noise_trap_rise_us",
            "noise_trap_flat_us",
            "noise_supply_noise_pp_mv",
            "noise_lab_broadband_rms_mv",
            "noise_mains_rms_mv",
            "noise_mains_frequency_hz",
            "noise_fano_factor",
            "field_solver",
            "mesh_edge_radius_ratio",
            "use_repeating_cell_approximation",
            "full_wave_resolution_per_mm",
            "full_wave_eqs_frequencies",
            "full_wave_frequencies",
            "full_wave_verify_resonances",
            "full_wave_timeout_hours",
            "thermal_min_temperature_c",
            "thermal_epoxy_modulus_gpa",
            "thermal_restraint_factor",
            "thermal_mesh_size_mm",
        }
        for language in ("fr", "de"):
            text = (locale_root / f"{language}.json").read_text(encoding="utf-8")
            catalog = json.loads(text)
            self.assertFalse(catalog["meta"]["experimental"])
            self.assertGreaterEqual(len(catalog["tooltips"]), 54)
            for source in required_text:
                self.assertIn(source, catalog["text"])
                self.assertNotEqual(catalog["text"][source], source)
            for source in required_content:
                self.assertIn(source, catalog["content"])
                self.assertNotEqual(catalog["content"][source], source)
            for control_id in required_tooltips:
                self.assertIn(control_id, catalog["tooltips"])
            for source in required_slides:
                self.assertIn(source, catalog["slides"])
                self.assertNotEqual(catalog["slides"][source], source)
            for source in required_canvas:
                self.assertIn(source, catalog["canvas"])
                self.assertNotEqual(catalog["canvas"][source], source)
            for mojibake in ("Ã", "Â", "â€", "Î", "Ï"):
                self.assertNotIn(mojibake, text)

    def test_reference_full_wave_result_is_restored_after_control_changes(self) -> None:
        root = Path(__file__).resolve().parents[2]
        app = (root / "presentations" / "web" / "app.js").read_text(encoding="utf-8")
        self.assertIn(
            "if (fullWaveCache?.key === fullWaveKey(params)) return fullWaveCache.result;",
            app,
        )
        self.assertIn(
            "return loadBundledDefaultFullWaveResult() ? fullWaveCache.result : null;",
            app,
        )

    def test_two_washer_cg_uses_shared_overlap_and_both_sides(self) -> None:
        params = {
            **axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS),
            "washer_id_mm": 6.0,
            "washer_od_mm": 20.0,
            "ground_plate_inner_diameter_mm": 8.0,
            "hv_plate_od_mm": 18.0,
            "plate_gap_mm": 1.5,
            "washer_epsr": 9.0,
            "washer_id_mode": "custom",
            "washer_od_mode": "custom",
        }
        overlap_area_mm2 = math.pi * ((18.0 / 2.0) ** 2 - (8.0 / 2.0) ** 2)
        expected_pf = (
            2.0
            * fenicsx_solver.EPSILON_0_PF_PER_MM
            * 9.0
            * overlap_area_mm2
            / 1.5
        )
        self.assertAlmostEqual(
            fenicsx_solver._analytic_two_washer_cg_pf(params),
            expected_pf,
            places=12,
        )

    def test_linux_meminfo_parser_returns_bytes(self) -> None:
        parsed = field_backend.parse_linux_meminfo(
            "MemTotal:       8192000 kB\nMemAvailable:   2048000 kB\nSwapTotal:      1024 kB\n"
        )
        self.assertEqual(parsed["MemTotal"], 8192000 * 1024)
        self.assertEqual(parsed["MemAvailable"], 2048000 * 1024)
        self.assertEqual(parsed["SwapTotal"], 1024 * 1024)

    def test_resource_log_records_field_model_reductions(self) -> None:
        params = field_backend.sanitized_parameters({"solve_strategy": "end_repeat_approx"})
        record = field_backend._resource_log_record("electric_field", params, {"samples": 3}, "complete")
        self.assertTrue(record["model_reduction"]["exact_mirror_symmetry_used"])
        self.assertTrue(record["model_reduction"]["repeating_cell_approximation_used"])
        self.assertFalse(record["model_reduction"]["full_stack_solved"])
        self.assertEqual(record["geometry_and_simulation_parameters"]["solve_strategy"], "end_repeat_approx")

    def test_resource_log_records_thermal_exact_mirror_model(self) -> None:
        params = field_backend.sanitized_parameters({})
        record = field_backend._resource_log_record("thermal", params, {}, "complete")
        self.assertTrue(record["model_reduction"]["exact_mirror_symmetry_used"])
        self.assertFalse(record["model_reduction"]["repeating_cell_approximation_used"])

    def test_thermal_parameters_are_sanitized(self) -> None:
        params = field_backend.sanitized_parameters({
            "thermal_min_temperature_c": -40.0,
            "thermal_epoxy_modulus_gpa": 3.2,
            "thermal_restraint_factor": 0.6,
            "thermal_mesh_size_mm": 0.25,
        })
        self.assertEqual(params["thermal_min_temperature_c"], -40.0)
        self.assertEqual(params["thermal_epoxy_modulus_gpa"], 3.2)
        self.assertEqual(params["thermal_restraint_factor"], 0.6)
        self.assertEqual(params["thermal_mesh_size_mm"], 0.25)

    def test_adjacent_pair_capacitance_energy_polarization_cancels_ground_terms(self) -> None:
        # Middle Cg = 33 pF, neighbor Cg total = 68 pF, and each of two
        # adjacent mutual capacitances is 0.4 pF.
        result = fenicsx_solver._adjacent_pair_capacitance_from_energies(
            middle_only_pf=33.8,
            neighbors_only_pf=68.8,
            all_bias_pf=101.0,
            neighbor_count=2,
        )
        self.assertAlmostEqual(result, 0.4)

    def test_middle_ground_capacitance_energy_polarization_removes_mutual_terms(self) -> None:
        # Middle Cg = 33 pF, neighbor Cg total = 68 pF, and each of two
        # adjacent mutual capacitances is 0.4 pF. The middle-only diagonal is
        # therefore 33.8 pF and must not be reported directly as Cg.
        result = fenicsx_solver._middle_ground_capacitance_from_energies(
            middle_only_pf=33.8,
            neighbors_only_pf=68.8,
            all_bias_pf=101.0,
        )
        self.assertAlmostEqual(result, 33.0)

    def test_two_three_cg_matrix_comparison_separates_end_and_center_nodes(self) -> None:
        two_network = {
            "node_ground_pf": [10.0, 10.0],
            "energy_solve_count": 2,
            "energy_solves_saved": 1,
            "single_excitation_representatives": [0, 0],
        }
        three_network = {
            "node_ground_pf": [10.2, 9.8, 10.2],
            "energy_solve_count": 3,
            "energy_solves_saved": 1,
            "single_excitation_representatives": [0, 1, 0],
        }
        result = fenicsx_solver._cg_matrix_plate_count_comparison(
            two_network,
            three_network,
        )
        self.assertAlmostEqual(result["two_bias_mean_ground_pf"], 10.0)
        self.assertAlmostEqual(result["three_bias_end_mean_ground_pf"], 10.2)
        self.assertAlmostEqual(result["three_bias_center_ground_pf"], 9.8)
        self.assertAlmostEqual(result["three_end_minus_two_fraction"], 0.02)
        self.assertAlmostEqual(result["three_center_minus_two_fraction"], -0.02)
        self.assertFalse(result["repeating_adds_small_matrix_reduction"])

    def test_capacitance_network_energy_polarization_recovers_ground_and_mutual_values(self) -> None:
        result = fenicsx_solver._capacitance_network_from_energy_equivalents(
            node_names=["hv_plate_0", "hv_plate_1", "hv_plate_2"],
            single_node_pf=[11.2, 23.0, 32.2],
            pair_node_pf={
                (0, 1): 32.2,
                (0, 2): 43.0,
                (1, 2): 51.2,
            },
            all_bias_pf=60.0,
        )

        for actual, expected in zip(result["node_ground_pf"], [10.0, 20.0, 30.0]):
            self.assertAlmostEqual(actual, expected)
        self.assertAlmostEqual(result["mutual_pf_matrix"][0][1], 1.0)
        self.assertAlmostEqual(result["mutual_pf_matrix"][0][2], 0.2)
        self.assertAlmostEqual(result["mutual_pf_matrix"][1][2], 2.0)
        self.assertAlmostEqual(result["total_ground_pf"], 60.0)
        self.assertEqual(result["energy_solve_count"], 7)

    def test_capacitance_excitation_plan_reuses_exact_mirror_symmetry(self) -> None:
        singles, pairs = fenicsx_solver._capacitance_excitation_representatives(
            6,
            use_repeating_interior=False,
        )
        self.assertEqual(singles, [0, 1, 2, 2, 1, 0])
        self.assertEqual(pairs[(0, 1)], pairs[(4, 5)])
        self.assertEqual(pairs[(1, 3)], pairs[(2, 4)])
        self.assertNotEqual(pairs[(0, 1)], pairs[(1, 2)])

    def test_capacitance_excitation_plan_reuses_repeating_interior_classes(self) -> None:
        singles, pairs = fenicsx_solver._capacitance_excitation_representatives(
            6,
            use_repeating_interior=True,
        )
        self.assertEqual(singles, [0, 1, 2, 2, 1, 0])
        self.assertEqual(len(set(singles)), 3)
        self.assertEqual(pairs[(0, 1)], pairs[(4, 5)])
        self.assertNotEqual(pairs[(0, 1)], pairs[(1, 2)])
        self.assertEqual(pairs[(1, 2)], pairs[(2, 3)])
        self.assertEqual(pairs[(2, 3)], pairs[(3, 4)])
        self.assertEqual(
            len(set(pairs.values())),
            8,
        )

    def test_five_bias_nodes_use_same_cpar_classes_in_both_modes(self) -> None:
        exact_singles, exact_pairs = fenicsx_solver._capacitance_excitation_representatives(
            5,
            use_repeating_interior=False,
        )
        repeat_singles, repeat_pairs = fenicsx_solver._capacitance_excitation_representatives(
            5,
            use_repeating_interior=True,
        )
        self.assertEqual(repeat_singles, exact_singles)
        self.assertEqual(repeat_pairs, exact_pairs)

    def test_repeating_ground_capacitance_has_end_and_interior_classes(self) -> None:
        self.assertEqual(
            fenicsx_solver._repeating_ground_capacitance_representatives(6),
            [0, 2, 2, 2, 2, 0],
        )

    def test_repeating_network_reconstructs_two_solved_regions_at_constant_cost(self) -> None:
        params = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        params["plate_pairs"] = 6
        network = fenicsx_solver._repeating_capacitance_network(
            params,
            end_region_pf=4.0,
            interior_half_cell_pf=5.0,
        )

        self.assertEqual(network["node_ground_pf"], [9.0, 10.0, 10.0, 10.0, 10.0, 9.0])
        self.assertEqual(network["total_ground_pf"], 58.0)
        self.assertEqual(network["energy_solve_count"], 2)
        self.assertEqual(network["energy_solve_count_without_symmetry"], 7)
        self.assertTrue(network["repeating_interior_approximation"])
        self.assertFalse(network["exact_full_stack"])
        self.assertFalse(network["node_ground_values_are_maxwell_row_sums"])
        self.assertFalse(network["mutual_values_are_fea_extracted"])
        self.assertFalse(network["capacitance_validity"]["node_ground_values"]["basis_fields_solved"])
        self.assertEqual(
            network["capacitance_validity"]["mutual_values"]["source"],
            "analytic-local-parallel-plate-screen",
        )
        self.assertEqual(len(network["mutual_pf_matrix"]), 6)
        self.assertGreaterEqual(network["average_adjacent_mutual_pf"], 0.0)

    def test_two_bias_nodes_share_one_symmetric_ground_excitation(self) -> None:
        for use_repeating_interior in (False, True):
            with self.subTest(use_repeating_interior=use_repeating_interior):
                singles, pairs = fenicsx_solver._capacitance_excitation_representatives(
                    2,
                    use_repeating_interior=use_repeating_interior,
                )
                self.assertEqual(singles, [0, 0])
                self.assertEqual(pairs, {(0, 1): (0, 1)})

    def test_repeating_ground_classes_make_end_and_interior_values_equal(self) -> None:
        network = fenicsx_solver._capacitance_network_from_energy_equivalents(
            node_names=[f"hv_plate_{index}" for index in range(6)],
            single_node_pf=[11.0, 21.0, 22.0, 22.0, 21.0, 11.0],
            pair_node_pf={
                (i, j): [11.0, 21.0, 22.0, 22.0, 21.0, 11.0][i]
                + [11.0, 21.0, 22.0, 22.0, 21.0, 11.0][j]
                - 0.2
                for i in range(6)
                for j in range(i + 1, 6)
            },
            all_bias_pf=90.0,
        )
        fenicsx_solver._apply_ground_capacitance_classes(
            network,
            [0, 2, 2, 2, 2, 0],
        )
        ground = network["node_ground_pf"]
        self.assertAlmostEqual(ground[0], ground[-1])
        for value in ground[1:-1]:
            self.assertAlmostEqual(value, ground[1])
        self.assertAlmostEqual(sum(ground), 90.0)

    def test_parallel_plate_cpar_reference_matches_type61_limiting_case(self) -> None:
        params = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        params.update({
            "core_material": "type61",
            "ferrite_epsr": 12.0,
            "use_direct_stage_circuit": False,
            "core_od_mm": 2.0,
            "ground_plate_inner_diameter_mm": 6.0,
            "hv_plate_od_mm": 8.0,
            "plate_gap_mm": 1.4,
            "washer_id_mode": "custom",
            "washer_od_mode": "custom",
        })
        self.assertAlmostEqual(
            fenicsx_solver._analytic_parallel_plate_cpar_pf(params),
            0.3550129944359252,
        )

    def test_cpar_gap_validation_geometry_survives_normalization(self) -> None:
        params = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        params.update({"core_od_mm": 2.0, "plate_pairs": 3})

        small = fenicsx_solver._cpar_gap_case_parameters(params, 2.0, 1.0)
        large = fenicsx_solver._cpar_gap_case_parameters(params, 50.0, 1.0)

        for case, expected_gap in ((small, 2.0), (large, 50.0)):
            self.assertAlmostEqual(case["core_to_ground_gap_mm"], expected_gap)
            self.assertAlmostEqual(
                case["ground_plate_inner_diameter_mm"],
                case["core_od_mm"] + 2.0 * expected_gap,
            )
            # Small validation discs are expanded by the model's 12 mm
            # manufacturability floor; the requested ground-hole gap must
            # still survive and the actual overlap must remain positive.
            self.assertGreaterEqual(
                case["hv_plate_od_mm"],
                case["ground_plate_inner_diameter_mm"] + 2.0,
            )
            self.assertGreater(case["tube_id_mm"], case["hv_plate_od_mm"])

        self.assertGreater(
            large["ground_plate_inner_diameter_mm"],
            small["ground_plate_inner_diameter_mm"],
        )

    def test_field_map_validation_compares_only_shared_dielectric_samples(self) -> None:
        grid = {
            "r_coords": [0.0, 1.0],
            "z_coords": [0.0, 1.0],
            "labels": [["dielectric", "hv"], ["dielectric", "dielectric"]],
        }
        reference = {
            "grid": grid,
            "field": [[100.0, 0.0], [50.0, 25.0]],
            "max_field_v_per_mm": 100.0,
            "max_location_mm": {"r": 0.0, "z": 0.0},
        }
        candidate = {
            "grid": grid,
            "field": [[101.0, 9999.0], [49.0, 25.0]],
            "max_field_v_per_mm": 101.0,
            "max_location_mm": {"r": 0.0, "z": 0.0},
        }

        comparison = fenicsx_solver._field_map_comparison(reference, candidate)

        self.assertEqual(comparison["dielectric_sample_count"], 3)
        self.assertAlmostEqual(comparison["peak_relative_difference"], 0.01)
        self.assertAlmostEqual(comparison["maximum_absolute_map_difference_v_per_mm"], 1.0)
        self.assertAlmostEqual(comparison["peak_location_distance_mm"], 0.0)

    def test_central_washer_validation_excludes_edges_and_conductors(self) -> None:
        grid = {
            "r_coords": [1.0, 2.0, 3.0, 4.0],
            "z_coords": [0.0, 1.0],
            "labels": [["dielectric", "dielectric"], ["dielectric", "hv"], ["dielectric", "dielectric"], ["dielectric", "dielectric"]],
            "materials": [["washer", "washer"] for _ in range(4)],
        }
        reference = {
            "parameters": {"washer_id_mm": 2.0, "washer_od_mm": 8.0},
            "grid": grid,
            "field": [[100.0, 100.0], [100.0, 9999.0], [100.0, 100.0], [100.0, 100.0]],
        }
        candidate = {
            "grid": grid,
            "field": [[500.0, 500.0], [101.0, 0.0], [99.0, 100.0], [500.0, 500.0]],
        }

        comparison = fenicsx_solver._central_washer_field_comparison(reference, candidate)

        self.assertEqual(comparison["sample_count"], 3)
        self.assertAlmostEqual(comparison["maximum_relative_difference"], 0.01)

    def test_direct_stage_resistance_and_capacitance_modes_are_independent(self) -> None:
        params = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        calculated = spice_ladder.circuit_estimates(params)
        entered = spice_ladder.circuit_estimates(axisymmetric_model.normalize_parameters({
            **params,
            "use_direct_stage_capacitance": True,
            "melf_stage_parasitic_pf": 0.3,
        }))

        self.assertEqual(calculated["stageResistanceOhm"], 12e6)
        self.assertAlmostEqual(calculated["parasiticPf"], 0.32195023865519884)
        self.assertAlmostEqual(entered["parasiticPf"], 0.47535241246074494)

    def test_direct_stage_capacitance_calibrates_core_permittivity(self) -> None:
        params = axisymmetric_model.normalize_parameters({
            **axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS),
            "use_direct_stage_capacitance": True,
            "melf_stage_parasitic_pf": 0.3,
        })
        radius_mm = params["core_od_mm"] / 2.0
        area_mm2 = math.pi * radius_mm**2
        length_mm = axisymmetric_model.stage_core_length_mm(params)
        recovered_pf = (
            axisymmetric_model.EPSILON_0_PF_PER_MM
            * axisymmetric_model.core_capacitance_epsr(params)
            * area_mm2
            / length_mm
        )

        self.assertAlmostEqual(recovered_pf, 0.3)
        self.assertGreater(spice_ladder.circuit_estimates(params)["parasiticPf"], recovered_pf)

    def test_spice_uses_node_resolved_fea_capacitance_network(self) -> None:
        params = axisymmetric_model.normalize_parameters({
            **axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS),
            "plate_pairs": 3,
        })
        circuit = spice_ladder.circuit_with_capacitance_network(
            spice_ladder.circuit_estimates(params),
            params,
            {
                "method": "test-fea-matrix",
                "node_ground_pf": [10.0, 20.0, 30.0],
                "mutual_pf_matrix": [
                    [0.0, 1.0, 0.2],
                    [1.0, 0.0, 2.0],
                    [0.2, 2.0, 0.0],
                ],
            },
        )

        self.assertEqual(circuit["shuntCapPfByNode"], [10.0, 20.0, 30.0])
        self.assertEqual(circuit["parasiticPfByAdjacentPair"], [1.0, 2.0])
        self.assertEqual(circuit["capacitanceSource"], "test-fea-matrix")
        netlist = spice_ladder.netlist_text(circuit, params)
        self.assertIn("Cg0 n0 0 1e-11", netlist)
        self.assertIn("Cg1 n1 0 2e-11", netlist)
        self.assertIn("Cg2 n2 0 3e-11", netlist)
        self.assertIn("Cpar1 n0 n1 1e-12", netlist)
        self.assertIn("Cpar2 n0 n2 2e-13", netlist)
        self.assertIn("Cpar3 n1 n2 2e-12", netlist)
        self.assertTrue(math.isfinite(abs(spice_ladder.ladder_transfer(circuit, params, 50.0))))

    def test_spice_uses_fea_terminal_capacitance_network(self) -> None:
        params = axisymmetric_model.normalize_parameters({
            **axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS),
            "plate_pairs": 2,
        })
        circuit = spice_ladder.circuit_with_capacitance_network(
            spice_ladder.circuit_estimates(params),
            params,
            {
                "method": "test-electrical-maxwell-matrix",
                "node_ground_pf": [10.0, 10.0],
                "mutual_pf_matrix": [[0.0, 1.0], [1.0, 0.0]],
                "electrical_node_ground_pf": [0.4, 10.0, 10.0, 0.4],
                "electrical_mutual_pf_matrix": [
                    [0.0, 0.6, 0.1, 0.02],
                    [0.6, 0.0, 1.0, 0.1],
                    [0.1, 1.0, 0.0, 0.6],
                    [0.02, 0.1, 0.6, 0.0],
                ],
            },
        )

        self.assertEqual(circuit["inputPortGroundCapPf"], 0.4)
        self.assertEqual(circuit["outputPortGroundCapPf"], 0.4)
        self.assertEqual(circuit["inputPortMutualPfByBias"], [0.6, 0.1])
        self.assertEqual(circuit["outputPortMutualPfByBias"], [0.1, 0.6])
        self.assertEqual(circuit["inputOutputMutualPf"], 0.02)
        netlist = spice_ladder.netlist_text(
            circuit,
            params,
            include_load=False,
            instrument_ports=True,
        )
        self.assertIn("CportInG src 0 4e-13", netlist)
        self.assertIn("CportOutG out 0 4e-13", netlist)
        self.assertIn("CportInBias0 src n0 6e-13", netlist)
        self.assertIn("CportOutBias1 out n1 6e-13", netlist)
        self.assertIn("CportInOut src out 2e-14", netlist)

    def test_additional_ground_capacitance_augments_cg_without_changing_cpar(self) -> None:
        params = axisymmetric_model.normalize_parameters({
            **axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS),
            "plate_pairs": 3,
            "additional_ground_capacitance_pf": 1000.0,
        })
        analytic = spice_ladder.circuit_estimates(params)
        self.assertAlmostEqual(
            analytic["shuntCapPf"],
            analytic["geometricShuntCapPf"] + 1000.0,
        )
        base = spice_ladder.circuit_estimates({
            **params,
            "additional_ground_capacitance_pf": 0.0,
        })

        circuit = spice_ladder.circuit_with_capacitance_network(
            analytic,
            params,
            {
                "method": "test-fea-matrix",
                "node_ground_pf": [10.0, 20.0, 30.0],
                "mutual_pf_matrix": [
                    [0.0, 1.0, 0.2],
                    [1.0, 0.0, 2.0],
                    [0.2, 2.0, 0.0],
                ],
            },
        )

        self.assertEqual(circuit["geometricShuntCapPfByNode"], [10.0, 20.0, 30.0])
        self.assertEqual(circuit["shuntCapPfByNode"], [1010.0, 1020.0, 1030.0])
        self.assertEqual(circuit["parasiticPfByAdjacentPair"], [1.0, 2.0])
        self.assertEqual(analytic["parasiticPf"], base["parasiticPf"])
        netlist = spice_ladder.netlist_text(circuit, params)
        self.assertIn("Cg0 n0 0 1.01e-09", netlist)
        self.assertIn("Cpar1 n0 n1 1e-12", netlist)

    def test_backend_sanitizes_additional_ground_capacitance(self) -> None:
        self.assertEqual(
            field_backend.sanitized_parameters({"additional_ground_capacitance_pf": 2500.0})[
                "additional_ground_capacitance_pf"
            ],
            2500.0,
        )
        self.assertEqual(
            field_backend.sanitized_parameters({"additional_ground_capacitance_pf": -1.0})[
                "additional_ground_capacitance_pf"
            ],
            0.0,
        )

    def test_ferrite_conductor_fill_scales_resistance_and_core_capacitance(self) -> None:
        base = axisymmetric_model.normalize_parameters({
            **axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS),
            "core_material": "type61",
            "use_direct_stage_circuit": False,
            "use_direct_stage_capacitance": False,
            "ferrite_epsr": 12.0,
            "ferrite_conductor_fill_factor": 0.0,
        })
        filled = axisymmetric_model.normalize_parameters({
            **base,
            "ferrite_conductor_fill_factor": 0.5,
        })

        base_r = spice_ladder.core_resistance_for_length_ohm(base, 4.5)
        filled_r = spice_ladder.core_resistance_for_length_ohm(filled, 4.5)
        self.assertAlmostEqual(filled_r / base_r, 0.5)
        self.assertAlmostEqual(axisymmetric_model.core_capacitance_epsr(filled), 24.0)

    def test_output_series_resistance_is_entered_in_ohms(self) -> None:
        params = field_backend.sanitized_parameters({"output_series_resistance_ohm": 50.0})
        circuit = spice_ladder.circuit_estimates(params)
        self.assertEqual(spice_ladder.series_resistance_ohm(params, circuit, "output"), 50.0)

        legacy = field_backend.sanitized_parameters({"output_series_resistance_mohm": 0.00005})
        legacy_circuit = spice_ladder.circuit_estimates(legacy)
        self.assertEqual(spice_ladder.series_resistance_ohm(legacy, legacy_circuit, "output"), 50.0)

    def test_matched_end_resistance_reuses_discrete_r_or_bulk_conductivity(self) -> None:
        base = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        direct = axisymmetric_model.normalize_parameters({
            **base,
            "use_direct_stage_circuit": True,
            "melf_stage_resistance_mohm": 12.0,
            "input_series_matches_stage": True,
            "output_series_matches_stage": True,
        })
        direct_circuit = spice_ladder.circuit_estimates(direct)
        self.assertEqual(spice_ladder.series_resistance_ohm(direct, direct_circuit, "input"), 12e6)
        self.assertEqual(spice_ladder.series_resistance_ohm(direct, direct_circuit, "output"), 12e6)

        material = axisymmetric_model.normalize_parameters({
            **base,
            "core_material": "type61",
            "use_direct_stage_circuit": False,
            "input_series_matches_stage": True,
            "output_series_matches_stage": True,
        })
        material_circuit = spice_ladder.circuit_estimates(material)
        expected_ratio = (
            axisymmetric_model.end_core_length_mm(material)
            / axisymmetric_model.stage_core_length_mm(material)
        )
        self.assertAlmostEqual(
            spice_ladder.series_resistance_ohm(material, material_circuit, "input")
            / material_circuit["stageResistanceOhm"],
            expected_ratio,
        )
        self.assertAlmostEqual(
            spice_ladder.series_resistance_ohm(material, material_circuit, "output")
            / material_circuit["stageResistanceOhm"],
            expected_ratio,
        )
        self.assertAlmostEqual(
            material["input_series_resistance_mohm"] * 1e6,
            axisymmetric_model.matched_end_series_resistance_ohm(material),
        )
        self.assertAlmostEqual(
            material["output_series_resistance_ohm"],
            axisymmetric_model.matched_end_series_resistance_ohm(material),
        )

    def test_isolated_single_stage_analytic_transfer_matches_full_mna(self) -> None:
        params = axisymmetric_model.normalize_parameters({
            **axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS),
            "plate_pairs": 1,
            "input_series_matches_stage": True,
            "output_series_matches_stage": False,
            "output_series_resistance_ohm": 0.0,
            "load_cable_length_m": 0.0,
            "detector_capacitance_pf": 0.0,
            "load_current_na": 0.0,
        })
        circuit = spice_ladder.circuit_estimates(params)
        frequency_hz = 50.0
        analytic = spice_ladder.scaled_stage_transfer(circuit, params, frequency_hz)
        full_mna = spice_ladder.ladder_transfer(circuit, params, frequency_hz, "none")
        self.assertAlmostEqual(abs(analytic), abs(full_mna), places=14)
        self.assertAlmostEqual(
            spice_ladder.attenuation_db(analytic),
            spice_ladder.attenuation_db(full_mna),
            places=12,
        )

    def test_unloaded_spice_model_ends_at_filter_output(self) -> None:
        params = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        circuit = spice_ladder.circuit_estimates(params)
        unloaded_netlist = spice_ladder.netlist_text(circuit, params, include_load=False)
        self.assertIn("Cg0", unloaded_netlist)
        self.assertNotIn("Tload", unloaded_netlist)
        self.assertNotIn("Cdet", unloaded_netlist)
        self.assertNotIn("Rload", unloaded_netlist)
        self.assertIn("Rout", unloaded_netlist)
        loaded_db = spice_ladder.attenuation_db(
            spice_ladder.ladder_transfer(circuit, params, 50.0, "transmission_line")
        )
        unloaded_db = spice_ladder.attenuation_db(
            spice_ladder.ladder_transfer(circuit, params, 50.0, "none")
        )
        self.assertGreater(loaded_db, unloaded_db)

    def test_50_ohm_instrument_curve_is_through_normalized(self) -> None:
        params = axisymmetric_model.normalize_parameters({
            **axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS),
            "plate_pairs": 1,
            "input_series_matches_stage": False,
            "input_series_resistance_mohm": 0.0,
            "output_series_matches_stage": False,
            "output_series_resistance_ohm": 0.0,
        })
        circuit = {
            **spice_ladder.circuit_estimates(params),
            "nodeGroundCapacitancesPf": [0.0],
            "mutualCapacitanceMatrixPf": [[0.0]],
        }
        measured = spice_ladder.ladder_transfer(circuit, params, 1e3, "instrument_50ohm")
        self.assertAlmostEqual(abs(measured), 1.0, places=10)
        self.assertAlmostEqual(spice_ladder.attenuation_db(measured), 0.0, places=9)

        instrument_netlist = spice_ladder.netlist_text(
            circuit,
            params,
            include_load=False,
            instrument_ports=True,
        )
        self.assertIn("Rsource50 gen n0 50", instrument_netlist)
        self.assertIn("Rmeasure50 n0 0 50", instrument_netlist)
        self.assertNotIn("Tload", instrument_netlist)

    def test_loaded_stage_multiplication_error_grows_with_stage_count(self) -> None:
        base = axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)
        ratios = []
        for stage_count in (2, 5, 10):
            params = axisymmetric_model.normalize_parameters({**base, "plate_pairs": stage_count})
            circuit = spice_ladder.circuit_estimates(params)
            multiplied_db = spice_ladder.attenuation_db(
                spice_ladder.scaled_stage_transfer(circuit, params, 50.0)
            )
            full_db = spice_ladder.attenuation_db(
                spice_ladder.ladder_transfer(circuit, params, 50.0, "lumped")
            )
            ratios.append(multiplied_db / full_db)
        self.assertLess(ratios[0], ratios[1])
        self.assertLess(ratios[1], ratios[2])

    def test_femtofarad_scale_capacitance_is_preserved(self) -> None:
        params = field_backend.sanitized_parameters({
            "melf_stage_parasitic_pf": 0.001,
            "detector_capacitance_pf": 0.0001,
        })
        self.assertEqual(params["melf_stage_parasitic_pf"], 0.001)
        self.assertEqual(params["detector_capacitance_pf"], 0.0001)

    def test_half_ounce_copper_plate_thickness_is_preserved(self) -> None:
        params = field_backend.sanitized_parameters({
            "bias_plate_thickness_mm": 0.0175,
            "ground_plate_thickness_mm": 0.0175,
            "ground_matches_bias_thickness": False,
        })
        self.assertEqual(params["bias_plate_thickness_mm"], 0.0175)
        self.assertEqual(params["ground_plate_thickness_mm"], 0.0175)

    def test_washer_relation_modes_derive_plate_edges_from_washer_dimensions(self) -> None:
        params = field_backend.sanitized_parameters({
            "core_od_mm": 2.0,
            "tube_id_mm": 24.0,
            "washer_id_mm": 8.0,
            "washer_od_mm": 18.0,
            "washer_id_mode": "ground_flat_id",
            "washer_od_mode": "bias_flat_od",
            "bias_plate_thickness_mm": 1.0,
            "ground_plate_thickness_mm": 1.0,
            "ground_matches_bias_thickness": False,
            "edge_diameter_percent": 100.0,
        })
        self.assertEqual(params["tube_id_mm"], 24.0)
        self.assertEqual(params["washer_id_mm"], 8.0)
        self.assertEqual(params["washer_od_mm"], 18.0)
        self.assertEqual(params["ground_plate_inner_diameter_mm"], 7.0)
        self.assertEqual(params["hv_plate_od_mm"], 19.0)
        self.assertEqual(params["core_to_ground_gap_mm"], 2.5)
        self.assertEqual(params["hv_to_tube_gap_mm"], 2.5)

        direct = field_backend.sanitized_parameters({
            "tube_id_mm": 24.0,
            "washer_id_mm": 7.0,
            "washer_od_mm": 19.0,
            "washer_id_mode": "ground_id",
            "washer_od_mode": "bias_od",
        })
        self.assertEqual(direct["ground_plate_inner_diameter_mm"], 7.0)
        self.assertEqual(direct["hv_plate_od_mm"], 19.0)

    def test_legacy_washer_match_booleans_map_to_custom_modes(self) -> None:
        params = field_backend.sanitized_parameters({
            "washer_id_matches_ground": False,
            "washer_od_matches_bias": False,
        })
        self.assertEqual(params["washer_id_mode"], "custom")
        self.assertEqual(params["washer_od_mode"], "custom")

    def test_sanitized_parameters_derive_geometry_and_clamp_solver_cost(self) -> None:
        params = field_backend.sanitized_parameters(
            {
                "core_od_mm": 6.0,
                "washer_id_mm": 10.0,
                "washer_od_mm": 32.0,
                "washer_id_mode": "ground_id",
                "washer_od_mode": "bias_od",
                "tube_id_mm": 36.0,
                "grid_r_count": 9999,
                "grid_z_count": 9999,
                "solver_iterations": 999999,
                "edge_diameter_percent": 100,
                "load_current_na": 123.0,
            }
        )

        self.assertEqual(params["ground_plate_inner_diameter_mm"], 10.0)
        self.assertEqual(params["ground_plate_od_mm"], 36.0)
        self.assertEqual(params["hv_plate_od_mm"], 32.0)
        self.assertEqual(params["solve_strategy"], field_backend.SOLVE_STRATEGY_END_REPEAT_APPROX)
        self.assertLessEqual(params["grid_r_count"], field_backend.MAX_GRID_R_COUNT)
        self.assertLessEqual(params["grid_z_count"], field_backend.MAX_GRID_Z_COUNT)
        self.assertLessEqual(params["solver_iterations"], field_backend.MAX_SOLVER_ITERATIONS)
        self.assertAlmostEqual(params["edge_radius_mm"], params["plate_thickness_mm"] / 2.0)
        self.assertEqual(params["load_current_na"], 123.0)
        self.assertFalse(params["use_direct_stage_capacitance"])

    def test_repeating_cell_checkbox_selects_explicit_approximation(self) -> None:
        approximate = field_backend.sanitized_parameters({
            "plate_pairs": 6,
            "use_repeating_cell_approximation": True,
        })
        self.assertEqual(approximate["solve_strategy"], field_backend.SOLVE_STRATEGY_END_REPEAT_APPROX)
        self.assertTrue(approximate["use_repeating_cell_approximation"])

        exact = field_backend.sanitized_parameters({
            "solve_strategy": field_backend.SOLVE_STRATEGY_END_REPEAT_APPROX,
            "use_repeating_cell_approximation": False,
        })
        self.assertEqual(exact["solve_strategy"], field_backend.SOLVE_STRATEGY_MIRROR_HALF)
        self.assertFalse(exact["use_repeating_cell_approximation"])

    def test_http_queue_returns_distinct_jobs_and_completed_result(self) -> None:
        with self._temporary_job_dir() as temp_dir:
            state = field_backend.BackendState(
                static_dir=field_backend.DEFAULT_STATIC_DIR,
                job_dir=Path(temp_dir),
                worker_count=1,
            )
            server = ThreadingHTTPServer(("127.0.0.1", 0), field_backend.make_handler(state))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{server.server_port}"

            try:
                first = self._post_json(
                    base_url + "/api/field-solve",
                    {"client_id": "test-a", "solver": "auto", "parameters": self._small_parameters()},
                )
                second = self._post_json(
                    base_url + "/api/field-solve",
                    {"client_id": "test-b", "solver": "fd", "parameters": self._small_parameters()},
                )

                self.assertEqual(first["status"], "queued")
                self.assertEqual(second["status"], "queued")
                self.assertEqual(first["solver"], "auto")
                self.assertEqual(second["solver"], "fd")
                self.assertNotEqual(first["job_id"], second["job_id"])

                completed = self._wait_for_complete(base_url, first["job_id"])
                self.assertEqual(completed["status"], "complete")
                self.assertEqual(completed["solver"], "auto")
                result = completed["result"]
                self.assertEqual(result["solverStatus"]["requested"], "auto")
                self.assertIn(result["solverStatus"]["effective"], {"fd", "fenicsx"})
                expected_source = (
                    "fea-backend-fenicsx"
                    if result["solverStatus"]["effective"] == "fenicsx"
                    else "fea-backend-axisymmetric-fd"
                )
                self.assertEqual(result["source"], expected_source)
                self.assertEqual(completed["source"], expected_source)
                self.assertEqual(result["solveStrategy"], field_backend.SOLVE_STRATEGY_END_REPEAT_APPROX)
                self.assertTrue(result["symmetryPlan"]["stack_is_mirror_symmetric"])
                self.assertIn(result["symmetryPlan"]["mirror_plate_kind"], {"ground", "hv"})
                self.assertTrue(result["symmetryValidation"]["required_before_using_reduced_strategy"])
                self.assertEqual(result["symmetryValidation"]["reference_strategy"], field_backend.SOLVE_STRATEGY_FULL_STACK)
                self.assertGreater(result["maxField"], 0)
                self.assertIn("bounds", result["grid"])
                self.assertIn("zMin", result["grid"]["bounds"])
                self.assertIn("zMax", result["grid"]["bounds"])
                self.assertIn("rMax", result["grid"]["bounds"])
                self.assertIn("rCoords", result["grid"])
                self.assertIn("zCoords", result["grid"])
                self.assertIn("mesh", result["grid"])
                self.assertEqual(len(result["grid"]["rCoords"]), result["grid"]["nr"])
                self.assertEqual(len(result["grid"]["zCoords"]), result["grid"]["nz"])
                expected_mesh_type = (
                    "gmsh-dolfinx-conforming"
                    if result["solverStatus"]["effective"] == "fenicsx"
                    else "nonuniform-structured-fd"
                )
                self.assertEqual(result["grid"]["mesh"]["type"], expected_mesh_type)
                if result["solverStatus"]["effective"] == "fd":
                    self.assertTrue(result["adaptive"]["enabled"])
                self.assertIn("r", result["maxLocation"])
                self.assertIn("z", result["maxLocation"])
                self.assertGreater(result["iterations"], 0)
                self.assertIn("lastDelta", result)
                self.assertEqual(len(result["field"]), result["grid"]["nr"])
                self.assertEqual(len(result["potential"]), result["grid"]["nr"])
                self.assertEqual(len(result["potential"][0]), result["grid"]["nz"])
                self.assertEqual(result["model"]["parameters"], result["parameters"])
                self.assertEqual(
                    result["model"]["boundaryConditions"]["biasPotentialV"],
                    result["parameters"]["bias_voltage_v"],
                )
                self.assertEqual(result["model"]["boundaryConditions"]["groundPotentialV"], 0.0)
                model_hv = [
                    component
                    for component in result["model"]["geometry"]["components"]
                    if component["material"] == "hv"
                ]
                self.assertTrue(model_hv)
                self.assertTrue(all(min(point["r"] for point in item["profile_mm"]) == 0.0 for item in model_hv))
                self.assertTrue((Path(temp_dir) / first["job_id"] / "result.json").is_file())

                health = self._get_json(base_url + "/api/health")
                self.assertEqual(health["status"], "ok")
            finally:
                server.shutdown()
                server.server_close()
                state.stop()
                thread.join(timeout=2.0)

    def test_static_serving_blocks_path_traversal(self) -> None:
        with self._temporary_job_dir() as temp_dir:
            state = field_backend.BackendState(field_backend.DEFAULT_STATIC_DIR, Path(temp_dir))
            server = ThreadingHTTPServer(("127.0.0.1", 0), field_backend.make_handler(state))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{server.server_port}"

            try:
                index = urllib.request.urlopen(base_url + "/index.html", timeout=5).read().decode("utf-8")
                self.assertIn("Discoidal Capacitor Bias Filter", index)
                self.assertIn('>Bias plates <output id="plate_pairs_out"', index)
                self.assertIn('id="plate_pairs" type="range" min="1" max="12" step="1"', index)
                self.assertIn('id="downloadInstallationDefault"', index)
                self.assertIn('id="slideConfigurationSource"', index)
                self.assertIn('<button class="tab active" type="button" data-view="slides">Slides</button>', index)
                self.assertIn('<section class="view slides active" id="slides"', index)
                self.assertIn('src="default-fenicsx-field.js?', index)
                self.assertIn('id="slideTocList"', index)
                self.assertNotIn('SPICE Transfer Without Cable or Output Load', index)
                self.assertIn('Electroquasistatic FEA Checks the Distributed RC Model', index)
                self.assertIn('From Damped Resonances to Field-Derived Transfer', index)
                self.assertIn('src="default-eqs-sweep.js?', index)
                self.assertIn('id="slideEqsCanvas"', index)
                self.assertIn('id="slideElectromagneticCanvas"', index)
                self.assertIn('<h2>Using the Modeler</h2>', index)
                self.assertIn('id="slideModelerCanvas"', index)
                self.assertIn('id="slideThermalConductorStudyCanvas"', index)
                self.assertIn('Soft Metal Helps Only the Bulk-Epoxy Layout', index)
                self.assertIn('CTE-Matched Metal Trades Tension for Lower Shear', index)

                app = urllib.request.urlopen(base_url + "/app.js", timeout=5).read().decode("utf-8")
                self.assertIn('fetch("default.json", { cache: "no-store" })', app)
                self.assertIn('downloadTextFile("default.json"', app)
                self.assertIn("function loadBundledDefaultFieldResult()", app)
                self.assertIn("const SLIDE_SECTION_DEFINITIONS", app)
                self.assertIn('label: "Main presentation"', app)
                self.assertIn('label: "Models & FEA results"', app)
                self.assertIn('label: "Validation & limiting cases"', app)
                self.assertIn("function electromagneticStageInductanceH", app)
                self.assertIn("function electromagneticTransferMagnitude", app)
                self.assertIn("function drawThermalConductorStudySlide", app)
                self.assertIn("function matchedModalOscillator", app)
                self.assertIn("zero-R f0 equals the first coupled peak", app)
                self.assertIn('window.addEventListener("hashchange"', app)

                bundled = urllib.request.urlopen(base_url + "/default-fenicsx-field.js", timeout=5).read().decode("utf-8")
                prefix = "window.DISCOIDAL_BUNDLED_DEFAULT_FIELD_RESULT = "
                self.assertTrue(bundled.startswith(prefix))
                payload = json.loads(bundled[len(prefix):].strip().removesuffix(";"))
                self.assertEqual(payload["format"], "discoidal-capacitor-bias-filter-bundled-field")
                self.assertEqual(payload["version"], 2)
                self.assertEqual(payload["settings"]["plate_pairs"], 3)
                self.assertEqual(payload["result"]["source"], "fea-backend-fenicsx")
                self.assertEqual(payload["result"]["solverStatus"]["effective"], "fenicsx")
                self.assertEqual(payload["result"]["grid"]["mesh"]["type"], "gmsh-dolfinx-conforming")
                capacitance = payload["result"]["capacitance"]
                self.assertEqual(capacitance["capacitance_network"]["method"], "fenicsx-maxwell-matrix-basis-cross-energy")
                self.assertIn("visualization_model", capacitance["capacitance_network"])
                self.assertIn("bias_to_ground_comparison", capacitance)
                self.assertFalse(payload["exactCapacitanceParameters"]["use_repeating_cell_approximation"])
                self.assertEqual(payload["exactCapacitanceParameters"]["solve_strategy"], "mirror_half")
                self.assertEqual(payload["spiceLadder"]["method"], "ngspice-batch-ac")
                self.assertEqual(len(payload["spiceLadder"]["samples"]), 161)

                eqs_bundle = urllib.request.urlopen(base_url + "/default-eqs-sweep.js", timeout=5).read().decode("utf-8")
                self.assertIn("DISCOIDAL_DEFAULT_EQS_SWEEP", eqs_bundle)

                with self.assertRaises(urllib.error.HTTPError) as raised:
                    urllib.request.urlopen(base_url + "/../hardware/geometry/default-parameters.json", timeout=5)
                self.assertEqual(raised.exception.code, 404)
            finally:
                server.shutdown()
                server.server_close()
                state.stop()
                thread.join(timeout=2.0)

    def test_geometry_endpoint_returns_solver_component_profiles(self) -> None:
        with self._temporary_job_dir() as temp_dir:
            state = field_backend.BackendState(field_backend.DEFAULT_STATIC_DIR, Path(temp_dir))
            server = ThreadingHTTPServer(("127.0.0.1", 0), field_backend.make_handler(state))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{server.server_port}"

            try:
                raw_parameters = self._small_parameters()
                raw_parameters["washer_id_mode"] = "ground_id"
                raw_parameters["washer_od_mode"] = "bias_od"
                payload = self._post_json(base_url + "/api/geometry", {"parameters": raw_parameters})
                self.assertEqual(payload["status"], "ok")
                geometry = payload["geometry"]
                self.assertEqual(geometry["units"], "mm")
                components = geometry["components"]
                washer_components = [component for component in components if component["material"] == "washer"]
                self.assertTrue(washer_components)
                hv_components = [component for component in components if component["material"] == "hv"]
                core_components = [component for component in components if component["material"] == "core"]
                self.assertEqual(len(hv_components), int(raw_parameters["plate_pairs"]))
                self.assertEqual(len(core_components), int(raw_parameters["plate_pairs"]) + 1)
                for component in hv_components:
                    self.assertEqual(min(point["r"] for point in component["profile_mm"]), 0.0)

                hv_intervals = [
                    (
                        min(point["z"] for point in component["profile_mm"]),
                        max(point["z"] for point in component["profile_mm"]),
                    )
                    for component in hv_components
                ]
                for component in core_components:
                    core_z0 = min(point["z"] for point in component["profile_mm"])
                    core_z1 = max(point["z"] for point in component["profile_mm"])
                    self.assertTrue(all(core_z1 <= hv_z0 or core_z0 >= hv_z1 for hv_z0, hv_z1 in hv_intervals))

                params = field_backend.sanitized_parameters(raw_parameters)
                washer_inner, washer_outer = field_backend.axisymmetric_model.washer_radial_bounds(params)
                profile = washer_components[0]["profile_mm"]
                radii = {round(point["r"], 6) for point in profile}
                self.assertIn(round(washer_inner, 6), radii)
                self.assertIn(round(washer_outer, 6), radii)
                self.assertIn(round(params["ground_plate_inner_diameter_mm"] / 2.0, 6), radii)
                self.assertIn(round(params["hv_plate_od_mm"] / 2.0, 6), radii)
            finally:
                server.shutdown()
                server.server_close()
                state.stop()
                thread.join(timeout=2.0)

    def test_static_directory_redirect_preserves_relative_asset_base(self) -> None:
        with self._temporary_job_dir() as temp_dir:
            root = Path(temp_dir)
            static_dir = root / "static"
            app_dir = static_dir / "filter"
            app_dir.mkdir(parents=True)
            (app_dir / "index.html").write_text(
                '<!doctype html><script src="app.js"></script>',
                encoding="utf-8",
            )
            (app_dir / "app.js").write_text("window.loaded = true;", encoding="utf-8")

            state = field_backend.BackendState(static_dir, root / "jobs")
            server = ThreadingHTTPServer(("127.0.0.1", 0), field_backend.make_handler(state))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()

            try:
                connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
                connection.request("GET", "/filter")
                response = connection.getresponse()
                self.assertEqual(response.status, 308)
                self.assertEqual(response.getheader("Location"), "/filter/")
                response.read()
                connection.close()

                index = urllib.request.urlopen(
                    f"http://127.0.0.1:{server.server_port}/filter/",
                    timeout=5,
                ).read().decode("utf-8")
                self.assertIn('src="app.js"', index)
            finally:
                server.shutdown()
                server.server_close()
                state.stop()
                thread.join(timeout=2.0)

    def test_artifact_downloads_are_allowlisted_and_zip_generated_outputs(self) -> None:
        with self._temporary_job_dir() as temp_dir:
            state = field_backend.BackendState(field_backend.DEFAULT_STATIC_DIR, Path(temp_dir))
            server = ThreadingHTTPServer(("127.0.0.1", 0), field_backend.make_handler(state))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{server.server_port}"

            try:
                manifest = self._get_json(base_url + "/api/artifacts")
                self.assertEqual(manifest["status"], "ok")
                self.assertEqual(manifest["totalCount"], 9)
                available = [item for item in manifest["files"] if item["available"]]
                self.assertTrue(available)
                self.assertNotIn("axisymmetric_model.py", {item["name"] for item in manifest["files"]})

                first = available[0]
                with urllib.request.urlopen(base_url + first["downloadUrl"], timeout=5) as response:
                    self.assertIn("attachment;", response.headers["Content-Disposition"])
                    self.assertGreater(len(response.read()), 0)

                with urllib.request.urlopen(base_url + "/api/artifacts.zip", timeout=10) as response:
                    self.assertEqual(response.headers["Content-Type"], "application/zip")
                    archive = zipfile.ZipFile(io.BytesIO(response.read()))
                    archived_names = set(archive.namelist())
                for item in available:
                    self.assertTrue(any(name.endswith("/" + item["name"]) for name in archived_names))

                with self.assertRaises(urllib.error.HTTPError) as raised:
                    urllib.request.urlopen(base_url + "/api/artifacts/axisymmetric_model.py", timeout=5)
                self.assertEqual(raised.exception.code, 404)
            finally:
                server.shutdown()
                server.server_close()
                state.stop()
                thread.join(timeout=2.0)

    def test_spice_ladder_endpoint_returns_transmission_line_sweep(self) -> None:
        with self._temporary_job_dir() as temp_dir:
            state = field_backend.BackendState(field_backend.DEFAULT_STATIC_DIR, Path(temp_dir))
            server = ThreadingHTTPServer(("127.0.0.1", 0), field_backend.make_handler(state))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{server.server_port}"

            try:
                raw_parameters = self._small_parameters()
                raw_parameters.update(
                    {
                        "load_cable_length_m": 10.0,
                        "load_cable_impedance_ohm": 50.0,
                        "load_cable_velocity_factor": 0.66,
                        "detector_capacitance_pf": 10.0,
                    }
                )
                payload = self._post_json(base_url + "/api/spice-ladder", {"parameters": raw_parameters})
                self.assertEqual(payload["status"], "ok")
                self.assertIn(payload["source"], {"backend-spice-style-mna", "ngspice-ac"})
                self.assertIn(payload["method"], {"internal-spice-style-ac-mna", "ngspice-batch-ac"})
                self.assertIn("Tload", payload["netlist"])
                self.assertIn("Rin", payload["netlist"])
                self.assertIn("Rout", payload["netlist"])
                self.assertEqual(payload["circuit"]["stages"], raw_parameters["plate_pairs"])
                self.assertEqual(payload["circuit"]["internalResistiveSections"], raw_parameters["plate_pairs"] - 1)
                self.assertEqual(payload["circuit"]["resistiveSections"], raw_parameters["plate_pairs"] + 1)
                self.assertGreater(payload["circuit"]["inputSeriesResistanceOhm"], 0.0)
                self.assertEqual(payload["circuit"]["outputSeriesResistanceOhm"], 50.0)
                self.assertGreater(payload["circuit"]["cableCapPf"], 0.0)
                self.assertGreater(payload["circuit"]["detectorCapPf"], 0.0)
                self.assertGreater(len(payload["samples"]), 10)
                first = payload["samples"][0]
                self.assertIn("fullTline", first)
                self.assertIn("fullLumped", first)
                self.assertIn("fullUnloaded", first)
                self.assertIn("instrument50Ohm", first)
                self.assertIn("scaledStage", first)
                self.assertGreaterEqual(payload["summary"]["at50Hz"]["fullTlineAttenuationDb"], 0.0)
                self.assertGreaterEqual(payload["summary"]["at50Hz"]["fullUnloadedAttenuationDb"], 0.0)
                self.assertGreaterEqual(payload["summary"]["at50Hz"]["instrument50OhmAttenuationDb"], 0.0)
                self.assertIn("Rsource50", payload["instrumentNetlist"])
                self.assertIn("Rmeasure50", payload["instrumentNetlist"])
            finally:
                server.shutdown()
                server.server_close()
                state.stop()
                thread.join(timeout=2.0)

    def test_thermal_solve_endpoint_returns_fenicsx_result(self) -> None:
        with self._temporary_job_dir() as temp_dir:
            state = field_backend.BackendState(field_backend.DEFAULT_STATIC_DIR, Path(temp_dir))
            server = ThreadingHTTPServer(("127.0.0.1", 0), field_backend.make_handler(state))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{server.server_port}"
            mocked_result = {
                "status": "ok",
                "source": "thermal-fenicsx",
                "epoxy_principal_tensile_stress_mpa": {"p99": 11.5, "raw_max": 14.0},
                "mesh": {"cells": 1234},
            }

            try:
                with mock.patch.object(field_backend, "solve_thermal_fenicsx_subprocess", return_value=mocked_result) as solve_mock:
                    payload = self._post_json(
                        base_url + "/api/thermal-solve",
                        {"parameters": {"thermal_min_temperature_c": -20.0, "thermal_mesh_size_mm": 0.2}},
                    )
                self.assertEqual(payload, mocked_result)
                submitted = solve_mock.call_args.args[0]
                self.assertEqual(submitted["thermal_min_temperature_c"], -20.0)
                self.assertEqual(submitted["thermal_mesh_size_mm"], 0.2)
            finally:
                server.shutdown()
                server.server_close()
                state.stop()
                thread.join(timeout=2.0)

    def test_full_wave_endpoint_returns_maxwell_result(self) -> None:
        with self._temporary_job_dir() as temp_dir:
            state = field_backend.BackendState(field_backend.DEFAULT_STATIC_DIR, Path(temp_dir))
            server = ThreadingHTTPServer(("127.0.0.1", 0), field_backend.make_handler(state))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{server.server_port}"
            mocked_result = {
                "status": "completed",
                "solver": "meep-axisymmetric-full-wave",
                "samples": [{"frequency_hz": 1e9, "magnitude_db": -60.0}],
            }
            try:
                with mock.patch.object(field_backend, "solve_full_wave_subprocess", return_value=mocked_result) as solve_mock:
                    payload = self._post_json(
                        base_url + "/api/full-wave-solve",
                        {"parameters": {
                            "full_wave_resolution_per_mm": 2.0,
                            "full_wave_timeout_hours": 48.0,
                            "full_wave_frequencies_hz": [1e9, 2e9],
                        }},
                    )
                    self.assertEqual(payload["status"], "queued")
                    for _ in range(100):
                        completed = self._get_json(base_url + f"/api/full-wave-solve/{payload['job_id']}")
                        if completed["status"] == "complete":
                            break
                        time.sleep(0.01)
                self.assertEqual(completed["result"], mocked_result)
                self.assertEqual(solve_mock.call_args.args[0]["full_wave_resolution_per_mm"], 2.0)
                self.assertEqual(solve_mock.call_args.args[0]["full_wave_timeout_hours"], 48.0)
                self.assertEqual(solve_mock.call_args.args[0]["full_wave_frequencies_hz"], [1e9, 2e9])
            finally:
                server.shutdown()
                server.server_close()
                state.stop()
                thread.join(timeout=2.0)

    def test_symmetry_plan_marks_mirror_half_as_exact(self) -> None:
        params = self._small_parameters()
        params["plate_pairs"] = 5
        params = field_backend.sanitized_parameters(params)

        plan = field_backend.stack_symmetry_plan(params)
        strategies = {strategy["name"]: strategy for strategy in plan["available_strategies"]}

        self.assertTrue(plan["stack_is_mirror_symmetric"])
        self.assertAlmostEqual(plan["mirror_z_mm"], field_backend.axisymmetric_model.stack_length_mm(params) / 2.0)
        self.assertEqual(plan["recommended_default"], field_backend.SOLVE_STRATEGY_END_REPEAT_APPROX)
        self.assertEqual(
            set(strategies),
            {
                field_backend.SOLVE_STRATEGY_FULL_STACK,
                field_backend.SOLVE_STRATEGY_MIRROR_HALF,
                field_backend.SOLVE_STRATEGY_END_REPEAT_APPROX,
            },
        )
        self.assertIn(field_backend.SOLVE_STRATEGY_FULL_STACK, strategies)
        self.assertIn(field_backend.SOLVE_STRATEGY_MIRROR_HALF, strategies)
        self.assertTrue(strategies[field_backend.SOLVE_STRATEGY_MIRROR_HALF]["is_exact_for_this_idealized_stack"])
        self.assertIn(
            "single-node",
            strategies[field_backend.SOLVE_STRATEGY_MIRROR_HALF]["invalid_excitation"],
        )
        self.assertIn(
            "Maxwell basis",
            strategies[field_backend.SOLVE_STRATEGY_END_REPEAT_APPROX]["invalid_excitation"],
        )

    def test_symmetry_validation_plan_requires_full_stack_reference(self) -> None:
        params = field_backend.sanitized_parameters(self._small_parameters())
        validation = field_backend.symmetry_validation_plan(params)
        check_names = {check["name"] for check in validation["checks"]}

        self.assertTrue(validation["required_before_using_reduced_strategy"])
        self.assertEqual(validation["reference_strategy"], field_backend.SOLVE_STRATEGY_FULL_STACK)
        self.assertEqual(validation["validation_type"], "code_regression_for_exact_symmetry")
        self.assertEqual(
            validation["candidate_strategies"],
            [field_backend.SOLVE_STRATEGY_MIRROR_HALF, field_backend.SOLVE_STRATEGY_END_REPEAT_APPROX],
        )
        self.assertIn(field_backend.SOLVE_STRATEGY_MIRROR_HALF, validation["candidate_strategies"])
        self.assertIn("peak_field", check_names)
        self.assertIn("mirrored_field_map", check_names)

    def test_custom_washer_bounds_can_leave_rounded_edge_pockets_as_epoxy(self) -> None:
        raw_parameters = self._small_parameters()
        raw_parameters["washer_id_mode"] = "custom"
        raw_parameters["washer_od_mode"] = "custom"
        raw_parameters["washer_id_mm"] = raw_parameters["ground_plate_inner_diameter_mm"] + 1.0
        raw_parameters["washer_od_mm"] = raw_parameters["hv_plate_od_mm"] - 1.0
        params = field_backend.sanitized_parameters(raw_parameters)
        washer_inner, washer_outer = field_backend.axisymmetric_model.washer_radial_bounds(params)
        gap_z0, gap_z1 = field_backend.axisymmetric_model.washer_gap_intervals(params)[0]
        z_mid = 0.5 * (gap_z0 + gap_z1)

        self.assertGreater(washer_inner, params["ground_plate_inner_diameter_mm"] / 2.0)
        self.assertLess(washer_outer, params["hv_plate_od_mm"] / 2.0)
        self.assertEqual(field_backend.axisymmetric_model.material_region(params, washer_inner - 0.01, z_mid), "epoxy")
        self.assertEqual(field_backend.axisymmetric_model.material_region(params, washer_inner + 0.01, z_mid), "washer")
        self.assertEqual(field_backend.axisymmetric_model.material_region(params, washer_outer - 0.01, z_mid), "washer")
        self.assertEqual(field_backend.axisymmetric_model.material_region(params, washer_outer + 0.01, z_mid), "epoxy")

    def test_epoxy_washer_choice_is_one_continuous_material_region(self) -> None:
        raw_parameters = self._small_parameters()
        raw_parameters.update({
            "washer_material": "epoxy",
            "washer_epsr": 10.0,
            "epoxy_epsr": 4.2,
        })
        params = field_backend.sanitized_parameters(raw_parameters)
        washer_inner, washer_outer = field_backend.axisymmetric_model.washer_radial_bounds(params)
        gap_z0, gap_z1 = field_backend.axisymmetric_model.washer_gap_intervals(params)[0]
        z_mid = 0.5 * (gap_z0 + gap_z1)
        r_mid = 0.5 * (washer_inner + washer_outer)

        self.assertEqual(params["washer_epsr"], params["epoxy_epsr"])
        self.assertEqual(field_backend.axisymmetric_model.material_region(params, r_mid, z_mid), "epoxy")
        self.assertFalse(any(
            component["material"] == "washer"
            for component in field_backend.axisymmetric_model.component_profiles(params)
        ))
        self.assertEqual(
            field_backend.thermal_fenicsx_solver._mechanical_material(params, r_mid, z_mid),
            "epoxy",
        )

    def _small_parameters(self) -> dict[str, float | int | bool]:
        params = field_backend.load_default_parameters()
        params.update(
            {
                "grid_r_count": 24,
                "grid_z_count": 34,
                "solver_iterations": 120,
                "solver_tolerance_v": 0.2,
            }
        )
        return params

    def _temporary_job_dir(self):
        root = field_backend.ROOT / "simulations" / "axisymmetric" / "test_jobs_tmp"
        root.mkdir(parents=True, exist_ok=True)
        path = root / uuid.uuid4().hex
        path.mkdir()

        class ScratchDir:
            def __enter__(self) -> str:
                return str(path)

            def __exit__(self, exc_type, exc, traceback) -> bool:
                return False

        return ScratchDir()

    def _wait_for_complete(self, base_url: str, job_id: str) -> dict[str, object]:
        # Auto mode invokes the real FEniCSx subprocess on a capable host. A
        # three-plate default can legitimately exceed the former 10 s window.
        deadline = time.time() + 30.0
        while time.time() < deadline:
            payload = self._get_json(f"{base_url}/api/field-solve/{job_id}")
            if payload["status"] == "complete":
                return payload
            if payload["status"] == "failed":
                self.fail(str(payload.get("error", "job failed")))
            time.sleep(0.1)
        self.fail("Timed out waiting for backend job")

    def _post_json(self, url: str, payload: dict[str, object]) -> dict[str, object]:
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))

    def _get_json(self, url: str) -> dict[str, object]:
        with urllib.request.urlopen(url, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
