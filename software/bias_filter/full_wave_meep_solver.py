#!/usr/bin/env python3
"""Axisymmetric full-wave Maxwell transfer and radiation solve using MEEP.

The model is the rotationally symmetric TM (m=0) reference for the generated
filter geometry.  It includes magnetic induction, displacement current,
distributed core conduction, open free space, and PML absorption.  It does not
represent non-axisymmetric leads, the MELF spiral, or asymmetric cavity modes;
those require the later 3D model.
"""

from __future__ import annotations

import argparse
import ctypes
import json
import math
import os
import re
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Iterable

try:
    from . import admittance_fenicsx_solver, axisymmetric_model, spice_ladder
except ImportError:  # Direct execution on the Pi.
    import admittance_fenicsx_solver
    import axisymmetric_model
    import spice_ladder


EPSILON_0_F_PER_M = 8.8541878128e-12
SPEED_OF_LIGHT_M_PER_S = 299_792_458.0
LENGTH_UNIT_M = 1e-3  # MEEP geometry coordinates are millimetres.
# EQS and MEEP share 300 MHz and 1 GHz. The first point anchors the provisional
# port normalization; the second independently checks slope before handoff.
DEFAULT_FREQUENCIES_HZ = (300e6, 1e9, 3e9, 10e9, 30e9)
DEFAULT_EQS_FREQUENCIES_HZ = (50.0, 100.0, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 300e6, 1e9)
RESONANCE_REFINEMENT_POINT_COUNT = 7
RESONANCE_REFINEMENT_HALF_SPAN_DECADES = 0.18


def _solve_cw_with_diagnostics(sim: Any, mp: Any, p: dict[str, Any]) -> dict[str, Any]:
    """Capture MEEP's native convergence report, which solve_cw does not return."""
    mp.verbosity(1)
    saved_stdout = os.dup(1)
    try:
        with tempfile.TemporaryFile(mode="w+b") as capture:
            sys.stdout.flush()
            ctypes.CDLL(None).fflush(None)
            os.dup2(capture.fileno(), 1)
            try:
                sim.init_sim()
                sim.solve_cw(
                    tol=float(p.get("full_wave_tolerance", 1e-4)),
                    maxiters=int(p.get("full_wave_max_iterations", 10_000)),
                    L=int(p.get("full_wave_bicgstab_l", 10)),
                )
            finally:
                sys.stdout.flush()
                ctypes.CDLL(None).fflush(None)
                os.dup2(saved_stdout, 1)
            capture.seek(0)
            log = capture.read().decode("utf-8", errors="replace")
    finally:
        os.close(saved_stdout)
    residual_matches = re.findall(r"final residual\s*=\s*([0-9.eE+-]+)", log)
    iteration_matches = re.findall(r"after\s+([0-9]+)\s+CG iters", log)
    failure = "CONVERGENCE FAILURE" in log
    return {
        "converged": not failure and bool(residual_matches),
        "final_residual": float(residual_matches[-1]) if residual_matches else None,
        "iterations": int(iteration_matches[-1]) if iteration_matches else None,
        "failure_reported": failure,
    }


def _import_meep() -> Any:
    import meep as mp  # type: ignore

    return mp


def dependency_status() -> dict[str, Any]:
    try:
        mp = _import_meep()
        return {
            "backend": "meep-axisymmetric-full-wave",
            "ready": True,
            "missing": [],
            "version": getattr(mp, "__version__", "unknown"),
            "formulation": "cylindrical m=0 full-wave Maxwell FDTD/CW with PML",
        }
    except Exception as exc:
        return {
            "backend": "meep-axisymmetric-full-wave",
            "ready": False,
            "missing": ["python3-meep"],
            "error": str(exc),
            "install_hint": "sudo apt install python3-meep",
        }


def resistance_sections_ohm(p: dict[str, Any]) -> list[dict[str, Any]]:
    """Return each physical core segment and its specified terminal resistance."""
    intervals = axisymmetric_model.core_segment_intervals(p)
    circuit = spice_ladder.circuit_estimates(p)
    stage_r = float(circuit["stageResistanceOhm"])
    input_r = spice_ladder.series_resistance_ohm(p, circuit, "input")
    output_r = spice_ladder.series_resistance_ohm(p, circuit, "output")
    sections = []
    for index, (z0, z1) in enumerate(intervals):
        if index == 0:
            role, resistance = "input", input_r
        elif index == len(intervals) - 1:
            role, resistance = "output", output_r
        else:
            role, resistance = "stage", stage_r
        sections.append({
            "index": index,
            "role": role,
            "z0_mm": float(z0),
            "z1_mm": float(z1),
            "length_mm": float(z1 - z0),
            "resistance_ohm": max(0.0, float(resistance)),
        })
    return sections


def section_conductivity_s_per_m(section: dict[str, Any], core_od_mm: float) -> float:
    radius_m = max(1e-15, core_od_mm * 0.5e-3)
    area_m2 = math.pi * radius_m**2
    length_m = max(1e-15, float(section["length_mm"]) * 1e-3)
    resistance = float(section["resistance_ohm"])
    if resistance <= 0.0:
        return math.inf
    return length_m / (resistance * area_m2)


def meep_d_conductivity(sigma_s_per_m: float) -> float:
    """Convert SI conductivity to MEEP's inverse-time material coefficient."""
    if not math.isfinite(sigma_s_per_m):
        return math.inf
    return sigma_s_per_m * LENGTH_UNIT_M / (EPSILON_0_F_PER_M * SPEED_OF_LIGHT_M_PER_S)


def _medium(mp: Any, epsr: float, sigma_s_per_m: float = 0.0) -> Any:
    if not math.isfinite(sigma_s_per_m):
        return mp.metal
    return mp.Medium(
        epsilon=max(1e-6, float(epsr)),
        D_conductivity=max(0.0, meep_d_conductivity(sigma_s_per_m)),
    )


def _cylinder(mp: Any, radius: float, z0: float, z1: float, material: Any) -> Any:
    return mp.Cylinder(
        radius=max(0.0, float(radius)),
        height=max(0.0, float(z1 - z0)),
        axis=mp.Vector3(0, 0, 1),
        center=mp.Vector3(0, 0, (z0 + z1) / 2.0),
        material=material,
    )


def build_geometry(p: dict[str, Any], mp: Any) -> tuple[list[Any], list[dict[str, Any]]]:
    """Build a sharp-edge RF geometry from the normalized axisymmetric model."""
    length = axisymmetric_model.stack_length_mm(p)
    core_r = float(p["core_od_mm"]) / 2.0
    tube_inner = float(p["tube_id_mm"]) / 2.0
    tube_outer = tube_inner + float(p["tube_wall_thickness_mm"])
    ground_inner = float(p["ground_plate_inner_diameter_mm"]) / 2.0
    ground_outer = float(p["ground_plate_od_mm"]) / 2.0
    hv_outer = float(p["hv_plate_od_mm"]) / 2.0
    epoxy = _medium(mp, float(p["epoxy_epsr"]))
    washer = _medium(mp, float(p["washer_epsr"]))
    geometry: list[Any] = []

    # Later objects override earlier overlapping objects in MEEP.
    if p.get("include_ground_tube", True):
        geometry.append(_cylinder(mp, tube_outer, 0.0, length, mp.metal))
    geometry.append(_cylinder(mp, tube_inner, 0.0, length, epoxy))

    if p.get("washer_material") != "epoxy":
        washer_inner, washer_outer = axisymmetric_model.washer_radial_bounds(p)
        for z0, z1 in axisymmetric_model.washer_gap_intervals(p):
            geometry.append(_cylinder(mp, washer_outer, z0, z1, washer))
            geometry.append(_cylinder(mp, washer_inner, z0, z1, epoxy))

    for kind, center in axisymmetric_model.plate_centers(p):
        if kind != "ground":
            continue
        half = axisymmetric_model.ground_plate_thickness_mm(p) / 2.0
        geometry.append(_cylinder(mp, ground_outer, center - half, center + half, mp.metal))
        geometry.append(_cylinder(mp, ground_inner, center - half, center + half, epoxy))

    sections = resistance_sections_ohm(p)
    core_epsr = axisymmetric_model.core_capacitance_epsr(p)
    for section in sections:
        sigma = section_conductivity_s_per_m(section, float(p["core_od_mm"]))
        section["conductivity_s_per_m"] = sigma
        section["meep_d_conductivity"] = meep_d_conductivity(sigma)
        material = mp.metal if not math.isfinite(sigma) else _medium(mp, core_epsr, sigma)
        geometry.append(_cylinder(mp, core_r, section["z0_mm"], section["z1_mm"], material))

    for kind, center in axisymmetric_model.plate_centers(p):
        if kind != "hv":
            continue
        half = axisymmetric_model.bias_plate_thickness_mm(p) / 2.0
        geometry.append(_cylinder(mp, hv_outer, center - half, center + half, mp.metal))
    return geometry, sections


def _terminal_voltage(sim: Any, mp: Any, z_mm: float, r0_mm: float, r1_mm: float, samples: int = 80) -> complex:
    if r1_mm <= r0_mm:
        return 0.0j
    dr = (r1_mm - r0_mm) / samples
    values = []
    for index in range(samples + 1):
        r = r0_mm + dr * index
        values.append(complex(sim.get_field_point(mp.Er, mp.Vector3(r, 0, z_mm))))
    return dr * sum((values[index] + values[index + 1]) / 2.0 for index in range(samples))


def _field_grid(sim: Any, mp: Any, r_max: float, z_min: float, z_max: float, nr: int = 72, nz: int = 144) -> dict[str, Any]:
    r_values = [r_max * index / (nr - 1) for index in range(nr)]
    z_values = [z_min + (z_max - z_min) * index / (nz - 1) for index in range(nz)]
    magnitude = []
    for z in z_values:
        row = []
        for r in r_values:
            er = complex(sim.get_field_point(mp.Er, mp.Vector3(r, 0, z)))
            ez = complex(sim.get_field_point(mp.Ez, mp.Vector3(r, 0, z)))
            ep = complex(sim.get_field_point(mp.Ep, mp.Vector3(r, 0, z)))
            row.append(math.sqrt(abs(er) ** 2 + abs(ez) ** 2 + abs(ep) ** 2))
        magnitude.append(row)
    return {"r_mm": r_values, "z_mm": z_values, "electric_field_magnitude": magnitude}


def solve_frequency(p: dict[str, Any], frequency_hz: float, resolution_per_mm: float, save_field: bool = False) -> dict[str, Any]:
    mp = _import_meep()
    length = axisymmetric_model.stack_length_mm(p)
    margin = max(4.0, float(p.get("full_wave_space_margin_mm", 8.0)))
    pml = max(1.0, min(margin * 0.45, float(p.get("full_wave_pml_mm", 3.0))))
    tube_outer = float(p["tube_id_mm"]) / 2.0 + float(p["tube_wall_thickness_mm"])
    r_max = tube_outer + margin
    z_min = -margin
    z_max = length + margin
    z_shift = -length / 2.0
    cell_z_min = z_min + z_shift
    cell_z_max = z_max + z_shift
    geometry, sections = build_geometry(p, mp)
    for obj in geometry:
        obj.center.z += z_shift

    ground_centers = [z for kind, z in axisymmetric_model.plate_centers(p) if kind == "ground"]
    input_z = ground_centers[0] + z_shift
    output_z = ground_centers[-1] + z_shift
    core_r = float(p["core_od_mm"]) / 2.0
    ground_inner = float(p["ground_plate_inner_diameter_mm"]) / 2.0
    probe_pad = max(0.05, 0.55 / resolution_per_mm)
    probe_r0 = min(ground_inner - probe_pad, core_r + probe_pad)
    probe_r1 = max(probe_r0 + 0.05, ground_inner - probe_pad)
    source_width = max(0.05, probe_r1 - probe_r0)
    frequency_meep = frequency_hz * LENGTH_UNIT_M / SPEED_OF_LIGHT_M_PER_S
    source = mp.Source(
        src=mp.ContinuousSource(frequency=frequency_meep),
        component=mp.Er,
        center=mp.Vector3((probe_r0 + probe_r1) / 2.0, 0, input_z),
        size=mp.Vector3(source_width, 0, 0),
        amplitude=1.0,
    )
    sim = mp.Simulation(
        cell_size=mp.Vector3(r_max, 0, z_max - z_min),
        dimensions=mp.CYLINDRICAL,
        m=0,
        geometry=geometry,
        boundary_layers=[mp.PML(pml, direction=mp.R), mp.PML(pml, direction=mp.Z)],
        sources=[source],
        resolution=resolution_per_mm,
        Courant=0.35,
        force_complex_fields=True,
    )
    monitor_pad = max(0.5, pml * 0.35)
    radial_monitor_r = r_max - pml - monitor_pad
    axial_monitor_half_r = max(0.1, r_max - pml - monitor_pad)
    axial_span = max(0.1, cell_z_max - cell_z_min - 2.0 * (pml + monitor_pad))
    radial_flux = sim.add_flux(
        frequency_meep,
        0,
        1,
        mp.FluxRegion(
            center=mp.Vector3(radial_monitor_r, 0, 0),
            size=mp.Vector3(0, 0, axial_span),
            direction=mp.R,
        ),
    )
    lower_flux = sim.add_flux(
        frequency_meep,
        0,
        1,
        mp.FluxRegion(
            center=mp.Vector3(axial_monitor_half_r / 2.0, 0, cell_z_min + pml + monitor_pad),
            size=mp.Vector3(axial_monitor_half_r, 0, 0),
            direction=mp.Z,
            weight=-1.0,
        ),
    )
    upper_flux = sim.add_flux(
        frequency_meep,
        0,
        1,
        mp.FluxRegion(
            center=mp.Vector3(axial_monitor_half_r / 2.0, 0, cell_z_max - pml - monitor_pad),
            size=mp.Vector3(axial_monitor_half_r, 0, 0),
            direction=mp.Z,
        ),
    )
    started = time.perf_counter()
    convergence = _solve_cw_with_diagnostics(sim, mp, p)
    vin = _terminal_voltage(sim, mp, input_z, probe_r0, probe_r1)
    vout = _terminal_voltage(sim, mp, output_z, probe_r0, probe_r1)
    transfer = vout / vin if abs(vin) > 1e-30 else 0.0j
    outward = {
        "radial": float(mp.get_fluxes(radial_flux)[0]),
        "input_side": float(mp.get_fluxes(lower_flux)[0]),
        "output_side": float(mp.get_fluxes(upper_flux)[0]),
    }
    outward_total = sum(outward.values())
    positive_outward = {name: max(0.0, value) for name, value in outward.items()}
    positive_outward_total = sum(positive_outward.values())
    outward_fractions = {
        name: value / positive_outward_total if positive_outward_total > 1e-30 else 0.0
        for name, value in positive_outward.items()
    }
    sample = {
        "frequency_hz": frequency_hz,
        "resolution_per_mm": resolution_per_mm,
        "vin": {"real": vin.real, "imag": vin.imag},
        "vout": {"real": vout.real, "imag": vout.imag},
        "vout_over_vin": {"real": transfer.real, "imag": transfer.imag},
        "magnitude": abs(transfer),
        "magnitude_db": 20.0 * math.log10(abs(transfer)) if abs(transfer) > 0 else -300.0,
        "phase_deg": math.degrees(math.atan2(transfer.imag, transfer.real)),
        "outward_flux_meep": {
            **outward,
            "signed_total": outward_total,
            "positive_outward_total": positive_outward_total,
        },
        "outward_flux_fraction": outward_fractions,
        "convergence": convergence,
        "solve_seconds": time.perf_counter() - started,
    }
    if save_field:
        sample["field"] = _field_grid(sim, mp, r_max - pml, cell_z_min + pml, cell_z_max - pml)
    sim.reset_meep()
    return sample


def resonance_candidates(
    coarse_samples: Iterable[dict[str, Any]],
    model_hints_hz: Iterable[float],
    minimum_hz: float,
    maximum_hz: float,
    max_candidates: int = 4,
) -> list[dict[str, Any]]:
    """Combine bracketed coarse peaks and circuit-model hints without duplicates."""
    ordered = sorted(coarse_samples, key=lambda sample: float(sample["frequency_hz"]))
    raw: list[dict[str, Any]] = []
    for index in range(1, len(ordered) - 1):
        before, sample, after = ordered[index - 1:index + 2]
        level = float(sample.get("magnitude_db", -math.inf))
        if level > float(before.get("magnitude_db", -math.inf)) and level > float(after.get("magnitude_db", -math.inf)):
            raw.append({
                "frequency_hz": float(sample["frequency_hz"]),
                "source": "coarse_local_maximum",
                "coarse_magnitude_db": level,
            })
    for hint in model_hints_hz:
        frequency = float(hint)
        if math.isfinite(frequency) and minimum_hz <= frequency <= maximum_hz:
            raw.append({"frequency_hz": frequency, "source": "low_loss_rlc_prediction"})

    # Keep measured peaks first, then model hints. Candidates within 8% share one
    # refinement window and retain both provenance labels.
    raw.sort(key=lambda item: (item["source"] != "coarse_local_maximum", -item.get("coarse_magnitude_db", -math.inf)))
    merged: list[dict[str, Any]] = []
    for candidate in raw:
        duplicate = next((
            existing for existing in merged
            if abs(math.log(candidate["frequency_hz"] / existing["frequency_hz"])) <= math.log(1.08)
        ), None)
        if duplicate:
            sources = set(duplicate["source"].split("+"))
            sources.add(candidate["source"])
            duplicate["source"] = "+".join(sorted(sources))
            continue
        merged.append(candidate)
        if len(merged) >= max_candidates:
            break
    return sorted(merged, key=lambda item: item["frequency_hz"])


def resonance_refinement_plan(
    candidates: Iterable[dict[str, Any]],
    minimum_hz: float,
    maximum_hz: float,
) -> list[dict[str, Any]]:
    """Build logarithmic fine-grid brackets around each suspected resonance."""
    plan = []
    for candidate in candidates:
        center = float(candidate["frequency_hz"])
        frequencies = sorted({
            max(minimum_hz, min(maximum_hz, center * 10.0 ** exponent))
            for exponent in (
                -RESONANCE_REFINEMENT_HALF_SPAN_DECADES
                + 2.0 * RESONANCE_REFINEMENT_HALF_SPAN_DECADES * index
                / (RESONANCE_REFINEMENT_POINT_COUNT - 1)
                for index in range(RESONANCE_REFINEMENT_POINT_COUNT)
            )
        })
        plan.append({**candidate, "frequencies_hz": frequencies})
    return plan


def verified_resonances(
    refinement_plan: Iterable[dict[str, Any]],
    fine_samples: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Report fine-grid peaks only when samples on both sides are lower."""
    by_frequency = {float(sample["frequency_hz"]): sample for sample in fine_samples}
    verified = []
    for region in refinement_plan:
        samples = [by_frequency[frequency] for frequency in region["frequencies_hz"] if frequency in by_frequency]
        samples.sort(key=lambda sample: float(sample["frequency_hz"]))
        if len(samples) < 3:
            continue
        peak_index = max(range(len(samples)), key=lambda index: float(samples[index].get("magnitude_db", -math.inf)))
        bracketed = (
            0 < peak_index < len(samples) - 1
            and float(samples[peak_index].get("magnitude_db", -math.inf)) > float(samples[peak_index - 1].get("magnitude_db", -math.inf))
            and float(samples[peak_index].get("magnitude_db", -math.inf)) > float(samples[peak_index + 1].get("magnitude_db", -math.inf))
        )
        if bracketed:
            peak = samples[peak_index]
            verified.append({
                "frequency_hz": float(peak["frequency_hz"]),
                "magnitude_db": float(peak["magnitude_db"]),
                "candidate_frequency_hz": float(region["frequency_hz"]),
                "candidate_source": region["source"],
                "bracket_hz": [float(samples[peak_index - 1]["frequency_hz"]), float(samples[peak_index + 1]["frequency_hz"])],
            })
    return verified


def solve_sweep(raw_parameters: dict[str, Any], frequencies_hz: Iterable[float] | None = None) -> dict[str, Any]:
    p = axisymmetric_model.normalize_parameters(dict(raw_parameters))
    resolution = max(1.0, min(12.0, float(raw_parameters.get("full_wave_resolution_per_mm", 2.0))))
    requested_frequencies = frequencies_hz or raw_parameters.get("full_wave_frequencies_hz", DEFAULT_FREQUENCIES_HZ)
    frequencies = sorted({float(value) for value in requested_frequencies})
    if not frequencies or any(value <= 0.0 for value in frequencies):
        raise ValueError("Full-wave frequencies must be positive.")
    started = time.perf_counter()
    requested_eqs = raw_parameters.get("full_wave_eqs_frequencies_hz", DEFAULT_EQS_FREQUENCIES_HZ)
    eqs_frequencies = sorted({float(value) for value in requested_eqs})
    if not eqs_frequencies or any(value <= 0.0 for value in eqs_frequencies):
        raise ValueError("EQS frequencies must be positive.")
    eqs_result = admittance_fenicsx_solver.solve_sweep(p, eqs_frequencies)
    eqs_samples = [
        {
            "frequency_hz": sample["frequency_hz"],
            "magnitude_db": sample["intrinsic_transfer"]["magnitude_db"],
            "phase_deg": sample["intrinsic_transfer"]["phase_deg"],
            "solve_seconds": sample["solve_seconds"],
            "reciprocity_max_abs_s": sample["reciprocity_max_abs_s"],
        }
        for sample in eqs_result["samples"]
    ]
    verify = bool(raw_parameters.get("full_wave_verify_resonances", False))
    coarse_resolution = max(1.0, min(resolution, resolution * 0.5)) if verify else resolution
    coarse_samples = []
    for index, frequency in enumerate(frequencies):
        sample = solve_frequency(
            p,
            frequency,
            coarse_resolution,
            save_field=not verify and index == len(frequencies) - 1,
        )
        sample["sweep_stage"] = "coarse" if verify else "requested"
        coarse_samples.append(sample)

    candidates: list[dict[str, Any]] = []
    refinement_plan: list[dict[str, Any]] = []
    fine_samples: list[dict[str, Any]] = []
    verified: list[dict[str, Any]] = []
    if verify:
        model_hints = raw_parameters.get("full_wave_resonance_hints_hz", ())
        candidates = resonance_candidates(coarse_samples, model_hints, min(frequencies), max(frequencies))
        refinement_plan = resonance_refinement_plan(candidates, min(frequencies), max(frequencies))
        fine_frequencies = sorted({frequency for region in refinement_plan for frequency in region["frequencies_hz"]})
        for index, frequency in enumerate(fine_frequencies):
            sample = solve_frequency(p, frequency, resolution, save_field=index == len(fine_frequencies) - 1)
            sample["sweep_stage"] = "resonance_refinement"
            fine_samples.append(sample)
        verified = verified_resonances(refinement_plan, fine_samples)

    samples_by_frequency = {float(sample["frequency_hz"]): sample for sample in coarse_samples}
    samples_by_frequency.update({float(sample["frequency_hz"]): sample for sample in fine_samples})
    samples = [samples_by_frequency[frequency] for frequency in sorted(samples_by_frequency)]
    normalization_frequency_hz = 300.0e6
    handoff_frequency_hz = 1.0e9
    eqs_by_frequency = {float(sample["frequency_hz"]): sample for sample in eqs_samples}
    wave_by_frequency = {float(sample["frequency_hz"]): sample for sample in samples}
    overlap_validation = {
        "normalization_frequency_hz": normalization_frequency_hz,
        "handoff_frequency_hz": handoff_frequency_hz,
        "tolerance_db": 2.0,
        "validated": False,
        "note": "The lower shared point sets one constant port offset; the upper shared point independently checks slope.",
    }
    if (
        normalization_frequency_hz in eqs_by_frequency
        and normalization_frequency_hz in wave_by_frequency
        and handoff_frequency_hz in eqs_by_frequency
        and handoff_frequency_hz in wave_by_frequency
    ):
        offset_db = (
            float(eqs_by_frequency[normalization_frequency_hz]["magnitude_db"])
            - float(wave_by_frequency[normalization_frequency_hz]["magnitude_db"])
        )
        residual_db = (
            float(wave_by_frequency[handoff_frequency_hz]["magnitude_db"])
            + offset_db
            - float(eqs_by_frequency[handoff_frequency_hz]["magnitude_db"])
        )
        overlap_validation.update({
            "normalization_offset_db": offset_db,
            "handoff_residual_db": residual_db,
            "validated": abs(residual_db) <= overlap_validation["tolerance_db"],
        })

    _geometry, sections = build_geometry(p, _import_meep())
    return {
        "solver": "meep-axisymmetric-full-wave",
        "status": "completed",
        "scope": "rotationally symmetric m=0 Maxwell fields with magnetic induction, distributed conduction, open free space, and PML",
        "limitations": [
            "The RF geometry uses sharp cylindrical plate edges; electrostatic peak-field decisions continue to use the rounded FEniCSx geometry.",
            "Non-axisymmetric leads, cavity modes, and the MELF spiral require a 3D solve.",
            "The terminal excitation is a distributed radial lumped port across each end core-to-ground aperture.",
        ],
        "parameters": p,
        "resolution_per_mm": resolution,
        "coarse_resolution_per_mm": coarse_resolution,
        "frequency_range_hz": [min(frequencies), max(frequencies)],
        "display_frequency_start_hz": 50.0,
        "low_frequency_solver": "FEniCSx electroquasistatic Maxwell limit through shared 300 MHz and 1 GHz overlap points",
        "resonance_search": "optional coarse MEEP sweep followed by fine-grid bracketing around measured and low-loss RLC candidates",
        "resonance_verification": {
            "enabled": verify,
            "definition": "A verified resonance is a fine-grid local transmission maximum with lower solved points on both sides.",
            "model_hints_hz": [float(value) for value in raw_parameters.get("full_wave_resonance_hints_hz", ())],
            "candidates": candidates,
            "refinement_regions": refinement_plan,
            "verified_resonances": verified,
        },
        "core_sections": sections,
        "eqs_samples": eqs_samples,
        "eqs_mesh": eqs_result["mesh"],
        "samples": samples,
        "coarse_samples": coarse_samples if verify else [],
        "refined_samples": fine_samples,
        "all_frequency_points_converged": bool(coarse_samples + fine_samples) and all(
            sample["convergence"]["converged"] for sample in coarse_samples + fine_samples
        ),
        "overlap_validation": overlap_validation,
        "elapsed_seconds": time.perf_counter() - started,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parameters", type=Path, default=axisymmetric_model.DEFAULT_PARAMETERS)
    parser.add_argument("--frequencies", nargs="+", type=float, default=list(DEFAULT_FREQUENCIES_HZ))
    parser.add_argument("--resolution-per-mm", type=float, default=2.0)
    parser.add_argument("--verify-resonances", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--dependency-status", action="store_true")
    parser.add_argument("--solve-stdin", action="store_true")
    args = parser.parse_args()
    if args.dependency_status:
        print(json.dumps(dependency_status(), indent=2))
        return 0
    if args.solve_stdin:
        parameters = json.load(sys.stdin)
    else:
        parameters = axisymmetric_model.load_parameters(args.parameters)
        parameters["full_wave_resolution_per_mm"] = args.resolution_per_mm
        if args.verify_resonances:
            parameters["full_wave_verify_resonances"] = True
    result = solve_sweep(parameters, None if args.solve_stdin else args.frequencies)
    payload = json.dumps(result, indent=2, allow_nan=False)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
