#!/usr/bin/env python3
"""Pi-hostable field-solve backend for the Discoidal Capacitor Bias Filter designer.

This server intentionally has no third-party dependencies. It serves the static
web designer and exposes the API shape already used by `presentations/web/app.js`:

    POST /api/field-solve
    GET  /api/field-solve/{job_id}
    POST /api/geometry

The current worker calls the repository's axisymmetric finite-difference solver.
That is still a screening solver, not final FEA. The point of this file is to
stage the multi-client backend and job contract so the worker can later be
swapped for a stronger FEA engine without changing the browser.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import math
import mimetypes
import queue
import subprocess
import sys
import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import axisymmetric_model
import fenicsx_solver
import spice_ladder
import thermal_fenicsx_solver


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_STATIC_DIR = ROOT / "presentations" / "web"
DEFAULT_JOB_DIR = ROOT / "simulations" / "axisymmetric" / "jobs"
DEFAULT_FEA_RESOURCE_LOG = ROOT / "simulations" / "axisymmetric" / "logs" / "fea-resource-usage.jsonl"

MAX_BODY_BYTES = 1_000_000
MAX_GRID_R_COUNT = 180
MAX_GRID_Z_COUNT = 280
MAX_SOLVER_ITERATIONS = 2500
FENICSX_SUBPROCESS_TIMEOUT_SECONDS = 15 * 60
THERMAL_FENICSX_SUBPROCESS_TIMEOUT_SECONDS = 15 * 60
JOB_RETENTION_SECONDS = 6 * 60 * 60
MIN_HALF_OZ_COPPER_THICKNESS_MM = 0.0175

SOLVE_STRATEGY_FULL_STACK = "full_stack"
SOLVE_STRATEGY_MIRROR_HALF = "mirror_half"
SOLVE_STRATEGY_END_REPEAT_APPROX = "end_repeat_approx"
SOLVE_STRATEGIES = {
    SOLVE_STRATEGY_FULL_STACK,
    SOLVE_STRATEGY_MIRROR_HALF,
    SOLVE_STRATEGY_END_REPEAT_APPROX,
}

SOLVER_FD = "fd"
SOLVER_AUTO = "auto"
SOLVER_FENICSX = "fenicsx"
FIELD_SOLVERS = {
    SOLVER_FD,
    SOLVER_AUTO,
    SOLVER_FENICSX,
}

FEA_RESOURCE_SAMPLE_INTERVAL_SECONDS = 0.1
FEA_RESOURCE_LOG_LOCK = threading.Lock()


@dataclass
class Job:
    job_id: str
    client_id: str
    parameters: dict[str, Any]
    solver_name: str
    status: str = "queued"
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    result: dict[str, Any] | None = None
    error: str | None = None


def load_default_parameters() -> dict[str, Any]:
    return axisymmetric_model.load_parameters(axisymmetric_model.DEFAULT_PARAMETERS)


def clamp_number(value: Any, lower: float, upper: float, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if number != number:
        return fallback
    return max(lower, min(upper, number))


def clamp_int(value: Any, lower: int, upper: int, fallback: int) -> int:
    return int(clamp_number(value, lower, upper, fallback))


def sanitized_parameters(raw_parameters: dict[str, Any]) -> dict[str, Any]:
    """Merge browser input with defaults and cap expensive solver settings."""
    params = load_default_parameters()
    extra_keys = {
        "bias_plate_thickness_mm",
        "ground_plate_thickness_mm",
        "ground_matches_bias_thickness",
        "bias_edge_radius_mm",
        "ground_edge_radius_mm",
        "edge_radius_mm",
        "mesh_edge_radius_ratio",
        "input_series_resistance_mohm",
        "output_series_resistance_ohm",
        "output_series_resistance_mohm",
        "input_series_matches_stage",
        "output_series_matches_stage",
        "melf_substrate_epsr",
        "melf_metal_fill_factor",
        "load_cable_length_m",
        "load_cable_impedance_ohm",
        "load_cable_velocity_factor",
        "detector_capacitance_pf",
        "washer_id_mode",
        "washer_od_mode",
        "washer_id_matches_ground",
        "washer_od_matches_bias",
        "use_repeating_cell_approximation",
        "thermal_min_temperature_c",
        "thermal_epoxy_modulus_gpa",
        "thermal_restraint_factor",
        "thermal_mesh_size_mm",
    }
    for key, value in raw_parameters.items():
        if key in params or key in extra_keys:
            params[key] = value
    if "washer_id_mode" not in raw_parameters and "washer_id_matches_ground" in raw_parameters:
        params["washer_id_mode"] = "custom" if raw_parameters["washer_id_matches_ground"] is False else "ground_id"
    if "washer_od_mode" not in raw_parameters and "washer_od_matches_bias" in raw_parameters:
        params["washer_od_mode"] = "custom" if raw_parameters["washer_od_matches_bias"] is False else "bias_od"

    params["bias_voltage_v"] = clamp_number(params.get("bias_voltage_v"), 0.0, 100_000.0, 6000.0)
    params["core_od_mm"] = clamp_number(params.get("core_od_mm"), 0.1, 100.0, 2.0)
    params["ground_plate_inner_diameter_mm"] = clamp_number(
        params.get("ground_plate_inner_diameter_mm"), params["core_od_mm"] + 0.02, 400.0, params["core_od_mm"] + 4.0
    )
    params["tube_id_mm"] = clamp_number(
        params.get("tube_id_mm"), max(12.02, params["ground_plate_inner_diameter_mm"] + 2.02), 400.0, 24.0
    )
    min_hv_plate_od_mm = max(12.0, params["ground_plate_inner_diameter_mm"] + 2.0)
    params["hv_plate_od_mm"] = clamp_number(
        params.get("hv_plate_od_mm"), min_hv_plate_od_mm, params["tube_id_mm"] - 0.02, 20.0
    )
    params["core_to_ground_gap_mm"] = (params["ground_plate_inner_diameter_mm"] - params["core_od_mm"]) / 2.0
    params["hv_to_tube_gap_mm"] = (params["tube_id_mm"] - params["hv_plate_od_mm"]) / 2.0
    params["bias_plate_thickness_mm"] = clamp_number(
        params.get("bias_plate_thickness_mm", params.get("plate_thickness_mm")),
        MIN_HALF_OZ_COPPER_THICKNESS_MM,
        20.0,
        1.0,
    )
    params["ground_matches_bias_thickness"] = bool(params.get("ground_matches_bias_thickness", False))
    if params["ground_matches_bias_thickness"]:
        params["ground_plate_thickness_mm"] = params["bias_plate_thickness_mm"]
    else:
        params["ground_plate_thickness_mm"] = clamp_number(
            params.get("ground_plate_thickness_mm", params.get("plate_thickness_mm")),
            MIN_HALF_OZ_COPPER_THICKNESS_MM,
            20.0,
            1.0,
        )
    params["plate_thickness_mm"] = params["bias_plate_thickness_mm"]
    params["plate_gap_mm"] = clamp_number(params.get("plate_gap_mm"), 0.01, 50.0, 1.0)
    min_pair_length_by_material = {
        "mmb0204_melf": 3.6,
        "mmb0207_melf": 5.8,
    }
    min_pair_length = min_pair_length_by_material.get(str(params.get("core_material", "")))
    if min_pair_length is not None:
        min_gap = max(0.01, (min_pair_length - params["bias_plate_thickness_mm"] - params["ground_plate_thickness_mm"]) / 2.0)
        params["plate_gap_mm"] = max(params["plate_gap_mm"], min_gap)
    params["tube_wall_thickness_mm"] = clamp_number(params.get("tube_wall_thickness_mm"), 0.01, 20.0, 1.0)
    params["domain_margin_mm"] = clamp_number(params.get("domain_margin_mm"), 0.0, 100.0, 4.0)
    params["plate_pairs"] = clamp_int(params.get("plate_pairs"), 1, 20, 2)
    params["grid_r_count"] = clamp_int(params.get("grid_r_count"), 12, MAX_GRID_R_COUNT, 76)
    params["grid_z_count"] = clamp_int(params.get("grid_z_count"), 16, MAX_GRID_Z_COUNT, 124)
    params["solver_iterations"] = clamp_int(params.get("solver_iterations"), 1, MAX_SOLVER_ITERATIONS, 520)
    params["solver_tolerance_v"] = clamp_number(params.get("solver_tolerance_v"), 1e-6, 1000.0, 0.04)
    params["mesh_edge_radius_ratio"] = clamp_number(params.get("mesh_edge_radius_ratio"), 0.005, 2.0, 0.2)
    params["ferrite_epsr"] = clamp_number(params.get("ferrite_epsr"), 1.0, 1000.0, 12.0)
    if "melf_stage_resistance_mohm" not in params and "melf_stage_resistance_log10_ohm" in params:
        params["melf_stage_resistance_mohm"] = (10.0 ** float(params["melf_stage_resistance_log10_ohm"])) / 1e6
    params["melf_stage_resistance_mohm"] = clamp_number(params.get("melf_stage_resistance_mohm"), 0.001, 1_000_000.0, 12.0)
    params["melf_stage_resistance_log10_ohm"] = math.log10(params["melf_stage_resistance_mohm"] * 1e6)
    params["melf_stage_parasitic_pf"] = clamp_number(params.get("melf_stage_parasitic_pf"), 0.001, 5.0, 0.3)
    params["melf_substrate_epsr"] = clamp_number(params.get("melf_substrate_epsr"), 1.0, 1000.0, 9.8)
    params["melf_metal_fill_factor"] = clamp_number(params.get("melf_metal_fill_factor"), 0.0, 0.95, 0.5)
    params["input_series_matches_stage"] = params.get("input_series_matches_stage", True) is not False
    params["output_series_matches_stage"] = bool(params.get("output_series_matches_stage", False))
    stage_mohm = params["melf_stage_resistance_mohm"]
    params["input_series_resistance_mohm"] = clamp_number(
        params.get("input_series_resistance_mohm"),
        0.0,
        1_000_000.0,
        stage_mohm if params["input_series_matches_stage"] else 0.0,
    )
    if "output_series_resistance_ohm" not in raw_parameters and "output_series_resistance_mohm" in raw_parameters:
        params["output_series_resistance_ohm"] = clamp_number(
            raw_parameters.get("output_series_resistance_mohm"), 0.0, 1_000_000.0, 0.0
        ) * 1e6
    params["output_series_resistance_ohm"] = clamp_number(
        params.get("output_series_resistance_ohm"),
        0.0,
        1_000_000_000_000.0,
        stage_mohm * 1e6 if params["output_series_matches_stage"] else 50.0,
    )
    if params["input_series_matches_stage"]:
        params["input_series_resistance_mohm"] = stage_mohm
    if params["output_series_matches_stage"]:
        params["output_series_resistance_ohm"] = stage_mohm * 1e6
    params["load_current_na"] = clamp_number(params.get("load_current_na"), 0.0, 1_000_000.0, 1.0)
    params["load_cable_length_m"] = clamp_number(params.get("load_cable_length_m"), 0.0, 10_000.0, 10.0)
    params["load_cable_impedance_ohm"] = clamp_number(params.get("load_cable_impedance_ohm"), 1.0, 10_000.0, 50.0)
    params["load_cable_velocity_factor"] = clamp_number(params.get("load_cable_velocity_factor"), 0.01, 1.0, 0.66)
    params["detector_capacitance_pf"] = clamp_number(params.get("detector_capacitance_pf"), 0.0, 1_000_000.0, 10.0)
    params["thermal_min_temperature_c"] = clamp_number(params.get("thermal_min_temperature_c"), -200.0, 70.0, 20.0)
    params["thermal_epoxy_modulus_gpa"] = clamp_number(params.get("thermal_epoxy_modulus_gpa"), 0.01, 100.0, 3.0)
    params["thermal_restraint_factor"] = clamp_number(params.get("thermal_restraint_factor"), 0.0, 1.0, 1.0)
    params["thermal_mesh_size_mm"] = clamp_number(params.get("thermal_mesh_size_mm"), 0.05, 2.0, 0.3)
    params["washer_epsr"] = clamp_number(params.get("washer_epsr"), 1.0, 1000.0, 10.0)
    params["washer_id_mode"] = params.get("washer_id_mode") if params.get("washer_id_mode") in axisymmetric_model.WASHER_ID_MODES else "ground_id"
    params["washer_od_mode"] = params.get("washer_od_mode") if params.get("washer_od_mode") in axisymmetric_model.WASHER_OD_MODES else "bias_od"
    params["washer_id_matches_ground"] = params["washer_id_mode"] == "ground_id"
    params["washer_od_matches_bias"] = params["washer_od_mode"] == "bias_od"
    params["washer_id_mm"] = clamp_number(params.get("washer_id_mm"), 0.01, 400.0, params.get("ground_plate_inner_diameter_mm", 6.6))
    params["washer_od_mm"] = clamp_number(params.get("washer_od_mm"), 0.02, 400.0, params.get("hv_plate_od_mm", 18.8))
    params["epoxy_epsr"] = clamp_number(params.get("epoxy_epsr"), 1.0, 1000.0, 3.7)
    params["rf_compare_frequency_log10_mhz"] = clamp_number(params.get("rf_compare_frequency_log10_mhz"), -3.0, 4.0, 0.0)
    params["plate_conductivity_log10_s_per_m"] = clamp_number(params.get("plate_conductivity_log10_s_per_m"), 5.0, 8.2, 7.7634)
    params["tube_conductivity_log10_s_per_m"] = clamp_number(params.get("tube_conductivity_log10_s_per_m"), 5.0, 8.2, 7.7634)
    params["plate_relative_permeability"] = clamp_number(params.get("plate_relative_permeability"), 1.0, 50.0, 1.0)
    params["tube_relative_permeability"] = clamp_number(params.get("tube_relative_permeability"), 1.0, 50.0, 1.0)

    if "edge_radius_mm" not in raw_parameters and "edge_diameter_percent" in params:
        percent = clamp_number(params["edge_diameter_percent"], 0.0, 100.0, 100.0)
        params["bias_edge_radius_mm"] = params["bias_plate_thickness_mm"] * percent / 200.0
        params["ground_edge_radius_mm"] = params["ground_plate_thickness_mm"] * percent / 200.0
        params["edge_radius_mm"] = min(params["bias_edge_radius_mm"], params["ground_edge_radius_mm"])
    else:
        params["edge_radius_mm"] = clamp_number(
            params.get("edge_radius_mm"),
            0.0,
            min(params["bias_plate_thickness_mm"], params["ground_plate_thickness_mm"]) / 2.0,
            0.5,
        )
        params["bias_edge_radius_mm"] = clamp_number(
            params.get("bias_edge_radius_mm", params["edge_radius_mm"]),
            0.0,
            params["bias_plate_thickness_mm"] / 2.0,
            params["edge_radius_mm"],
        )
        params["ground_edge_radius_mm"] = clamp_number(
            params.get("ground_edge_radius_mm", params["edge_radius_mm"]),
            0.0,
            params["ground_plate_thickness_mm"] / 2.0,
            params["edge_radius_mm"],
        )

    params["include_ground_tube"] = bool(params.get("include_ground_tube", True))
    params["use_direct_stage_circuit"] = bool(params.get("use_direct_stage_circuit", False))
    params["use_direct_stage_capacitance"] = bool(
        raw_parameters.get(
            "use_direct_stage_capacitance",
            params["use_direct_stage_circuit"] and not str(params.get("core_material", "")).startswith("mmb020"),
        )
    )
    if bool(params.get("use_repeating_cell_approximation", False)):
        params["solve_strategy"] = SOLVE_STRATEGY_END_REPEAT_APPROX
    else:
        params["solve_strategy"] = sanitize_solve_strategy(params.get("solve_strategy", SOLVE_STRATEGY_MIRROR_HALF))
        if params["solve_strategy"] == SOLVE_STRATEGY_END_REPEAT_APPROX:
            params["solve_strategy"] = SOLVE_STRATEGY_MIRROR_HALF
    params["use_repeating_cell_approximation"] = params["solve_strategy"] == SOLVE_STRATEGY_END_REPEAT_APPROX
    return axisymmetric_model.normalize_parameters(params)


def sanitize_solve_strategy(value: Any) -> str:
    if isinstance(value, str) and value in SOLVE_STRATEGIES:
        return value
    return SOLVE_STRATEGY_FULL_STACK


def center_plate_kind(p: dict[str, Any]) -> str:
    """Return the kind of the plate centered on the mirror plane."""
    centers = axisymmetric_model.plate_centers(p)
    return centers[len(centers) // 2][0]


def stack_symmetry_plan(p: dict[str, Any]) -> dict[str, Any]:
    """Describe the exact mirror symmetry used by the FEniCSx worker.

    The physical stack starts and ends on ground plates. With uniform plate
    thickness/gap/material definitions, it is mirror-symmetric about the center
    of the middle plate. FEniCSx solves the half-domain and mirrors the field
    back into the full browser result shape. The finite-difference screening
    worker continues to solve its full structured grid.
    """
    length = axisymmetric_model.stack_length_mm(p)
    pairs = int(p["plate_pairs"])
    return {
        "stack_is_mirror_symmetric": True,
        "mirror_z_mm": length / 2.0,
        "mirror_plate_kind": center_plate_kind(p),
        "full_stack_plate_pairs": pairs,
        "recommended_default": SOLVE_STRATEGY_END_REPEAT_APPROX,
        "available_strategies": [
            {
                "name": SOLVE_STRATEGY_FULL_STACK,
                "purpose": "Validation and browser-aligned full field plots.",
            },
            {
                "name": SOLVE_STRATEGY_MIRROR_HALF,
                "purpose": "Solve one end through the middle plate, then mirror across the center plane.",
                "boundary": "Mirror plane uses even-potential symmetry, dV/dz = 0, outside fixed conductor cells.",
                "is_exact_for_this_idealized_stack": True,
            },
            {
                "name": SOLVE_STRATEGY_END_REPEAT_APPROX,
                "purpose": "Solve end-to-first-bias-center and bias-center-to-next-ground-center regions, then copy and mirror them through the stack.",
                "boundary": "Cuts use zero-normal-flux at the assumed bias-plate and ground-plate axial symmetry planes.",
                "is_exact_for_this_idealized_stack": False,
            },
        ],
    }


def symmetry_validation_plan(p: dict[str, Any]) -> dict[str, Any]:
    """Define the required code check for the exact mirror-half solve."""
    pairs = int(p["plate_pairs"])
    return {
        "required_before_using_reduced_strategy": True,
        "reference_strategy": SOLVE_STRATEGY_FULL_STACK,
        "candidate_strategies": [
            SOLVE_STRATEGY_MIRROR_HALF,
            SOLVE_STRATEGY_END_REPEAT_APPROX,
        ],
        "validation_type": "code_regression_for_exact_symmetry",
        "checks": [
            {
                "name": "peak_field",
                "comparison": "max absolute field from mirrored half-stack versus full-stack reference",
                "suggested_relative_tolerance": 0.005,
                "suggested_absolute_tolerance_v_per_mm": 10.0,
            },
            {
                "name": "peak_location",
                "comparison": "peak location should map to the same physical edge class after mirroring",
                "suggested_position_tolerance_mm": max(
                    p["plate_gap_mm"],
                    p["bias_plate_thickness_mm"],
                    p["ground_plate_thickness_mm"],
                ) / 2.0,
            },
            {
                "name": "mirrored_field_map",
                "comparison": "reconstructed full field from the half-stack should match full-stack field samples",
                "suggested_relative_tolerance": 0.01,
            },
        ],
        "notes": [
            "Mirror symmetry is exact for the idealized uniform stack; this validation checks the implementation, not the physics assumption.",
            "The repeating-cell approximation is the operational default; retain mirror-half and full-stack cases as validation references for finite-stack end effects.",
            "Tolerances allow for discretization and interpolation differences between full and reconstructed grids during solver development.",
        ],
        "applies_to_plate_pairs": pairs,
    }


def result_for_browser(
    raw_result: dict[str, Any],
    source: str = "fea-backend-axisymmetric-fd",
    solver: str = "axisymmetric-finite-difference-screening",
    note: str | None = None,
) -> dict[str, Any]:
    grid = raw_result["grid"]
    return {
        "source": source,
        "solver": solver,
        "solveStrategy": raw_result["parameters"].get("solve_strategy", SOLVE_STRATEGY_FULL_STACK),
        "symmetryPlan": stack_symmetry_plan(raw_result["parameters"]),
        "symmetryValidation": symmetry_validation_plan(raw_result["parameters"]),
        "grid": {
            "nr": grid["nr"],
            "nz": grid["nz"],
            "dr": grid["dr"],
            "dz": grid["dz"],
            "rCoords": grid.get("r_coords"),
            "zCoords": grid.get("z_coords"),
            "labels": grid.get("labels"),
            "materials": grid.get("materials"),
            "mesh": grid.get("mesh"),
            "bounds": {
                "zMin": grid["z_min"],
                "zMax": grid["z_max"],
                "rMax": grid["r_max"],
            },
        },
        "field": raw_result["field"],
        "maxField": raw_result["max_field_v_per_mm"],
        "maxLocation": raw_result["max_location_mm"],
        "rawMaxField": raw_result.get("raw_max_field_v_per_mm", raw_result["max_field_v_per_mm"]),
        "rawMaxLocation": raw_result.get("raw_max_location_mm", raw_result["max_location_mm"]),
        "dielectricPeaks": raw_result.get("dielectric_peaks"),
        "rawDielectricPeaks": raw_result.get("raw_dielectric_peaks"),
        "peakQuality": raw_result.get("peak_quality"),
        "iterations": raw_result["iterations_run"],
        "lastDelta": raw_result["last_delta_v"],
        "adaptive": raw_result.get("adaptive"),
        "capacitance": raw_result.get("capacitance"),
        "admittance": raw_result.get("admittance"),
        "resource_usage": raw_result.get("resource_usage"),
        "resource_log": raw_result.get("resource_log"),
        "parameters": raw_result["parameters"],
        "note": note
        or "Backend uses a nonuniform structured finite-difference screening solver with deterministic rounded-edge refinement and a high-field probe refinement pass; future FEM should use exact mirror-half symmetry where appropriate.",
    }


class BackendState:
    def __init__(self, static_dir: Path, job_dir: Path, worker_count: int = 1, solver_name: str = SOLVER_FD) -> None:
        self.static_dir = static_dir.resolve()
        self.job_dir = job_dir.resolve()
        self.job_dir.mkdir(parents=True, exist_ok=True)
        self.solver_name = sanitize_field_solver(solver_name)
        self.jobs: dict[str, Job] = {}
        self.jobs_lock = threading.Lock()
        self.job_queue: queue.Queue[str | None] = queue.Queue()
        self.workers = [
            threading.Thread(target=self._worker_loop, name=f"field-worker-{index}", daemon=True)
            for index in range(max(1, worker_count))
        ]
        for worker in self.workers:
            worker.start()

    def submit(self, client_id: str, raw_parameters: dict[str, Any], solver_name: str | None = None) -> Job:
        self.cleanup_old_jobs()
        job = Job(
            job_id=uuid.uuid4().hex,
            client_id=client_id or "browser",
            parameters=sanitized_parameters(raw_parameters),
            solver_name=sanitize_field_solver(solver_name or self.solver_name),
        )
        with self.jobs_lock:
            self.jobs[job.job_id] = job
        self._write_job_file(job, "input.json", job.parameters)
        self.job_queue.put(job.job_id)
        return copy.deepcopy(job)

    def solver_status(self, solver_name: str | None = None) -> dict[str, Any]:
        requested = sanitize_field_solver(solver_name or self.solver_name)
        fenicsx_status = fenicsx_solver.dependency_status()
        effective = SOLVER_FD
        reason = "Finite-difference screening solver selected."
        if requested == SOLVER_FENICSX:
            effective = SOLVER_FENICSX
            reason = "FEniCSx explicitly requested; jobs fail until dependencies and conforming solver are ready."
        elif requested == SOLVER_AUTO:
            if fenicsx_status["ready"]:
                effective = SOLVER_FENICSX
                reason = "FEniCSx is ready and selected by auto mode."
            else:
                reason = "Auto mode is using finite-difference fallback because the FEniCSx filter solver is not ready."
        return {
            "requested": requested,
            "effective": effective,
            "reason": reason,
            "fenicsx": fenicsx_status,
        }

    def get_job(self, job_id: str) -> Job | None:
        with self.jobs_lock:
            job = self.jobs.get(job_id)
            return copy.deepcopy(job) if job else None

    def stop(self) -> None:
        for _ in self.workers:
            self.job_queue.put(None)
        for worker in self.workers:
            worker.join(timeout=2.0)

    def cleanup_old_jobs(self) -> None:
        cutoff = time.time() - JOB_RETENTION_SECONDS
        with self.jobs_lock:
            old_ids = [job_id for job_id, job in self.jobs.items() if job.updated_at < cutoff]
            for job_id in old_ids:
                del self.jobs[job_id]

    def _worker_loop(self) -> None:
        while True:
            job_id = self.job_queue.get()
            if job_id is None:
                self.job_queue.task_done()
                return
            try:
                self._run_job(job_id)
            finally:
                self.job_queue.task_done()

    def _run_job(self, job_id: str) -> None:
        with self.jobs_lock:
            job = self.jobs.get(job_id)
            if job is None:
                return
            job.status = "running"
            job.updated_at = time.time()

        try:
            result = self._solve_job(job.parameters, job.solver_name)
            self._write_job_file(job, "result.json", result)
            with self.jobs_lock:
                job = self.jobs[job_id]
                job.status = "complete"
                job.result = result
                job.updated_at = time.time()
        except Exception as exc:  # pragma: no cover - defensive error path.
            with self.jobs_lock:
                job = self.jobs[job_id]
                job.status = "failed"
                job.error = f"{type(exc).__name__}: {exc}"
                job.updated_at = time.time()
            self._write_job_file(job, "error.txt", traceback.format_exc())

    def _solve_job(self, parameters: dict[str, Any], solver_name: str) -> dict[str, Any]:
        solver_status = self.solver_status(solver_name)
        if solver_status["effective"] == SOLVER_FENICSX:
            raw_result = solve_fenicsx_subprocess(copy.deepcopy(parameters))
            result = result_for_browser(
                raw_result,
                source="fea-backend-fenicsx",
                solver="axisymmetric-fenicsx",
                note="FEniCSx/DOLFINx conforming FEA solve.",
            )
            result["solverStatus"] = solver_status
            return result

        raw_result = axisymmetric_model.solve(copy.deepcopy(parameters))
        result = result_for_browser(raw_result)
        result["solverStatus"] = solver_status
        return result

    def _write_job_file(self, job: Job, name: str, payload: Any) -> None:
        path = self.job_dir / job.job_id
        path.mkdir(parents=True, exist_ok=True)
        target = path / name
        if isinstance(payload, str):
            target.write_text(payload, encoding="utf-8")
        else:
            target.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def parse_linux_meminfo(text: str) -> dict[str, int]:
    values: dict[str, int] = {}
    for line in text.splitlines():
        if ":" not in line:
            continue
        name, raw_value = line.split(":", 1)
        parts = raw_value.strip().split()
        if parts and parts[0].isdigit():
            values[name] = int(parts[0]) * 1024
    return values


def _linux_process_snapshot() -> dict[int, tuple[int, int, int]]:
    snapshot: dict[int, tuple[int, int, int]] = {}
    proc = Path("/proc")
    if not proc.is_dir():
        return snapshot
    for status_path in proc.glob("[0-9]*/status"):
        try:
            fields: dict[str, str] = {}
            for line in status_path.read_text(encoding="utf-8", errors="replace").splitlines():
                if ":" in line:
                    name, value = line.split(":", 1)
                    fields[name] = value.strip()
            pid = int(fields.get("Pid", status_path.parent.name).split()[0])
            ppid = int(fields.get("PPid", "0").split()[0])
            rss = int(fields.get("VmRSS", "0 kB").split()[0]) * 1024
            swap = int(fields.get("VmSwap", "0 kB").split()[0]) * 1024
            snapshot[pid] = (ppid, rss, swap)
        except (OSError, ValueError):
            continue
    return snapshot


def _sample_resource_usage(root_pid: int, usage: dict[str, Any]) -> None:
    try:
        meminfo = parse_linux_meminfo(Path("/proc/meminfo").read_text(encoding="utf-8"))
    except OSError:
        meminfo = {}
    process_snapshot = _linux_process_snapshot()
    descendants = {root_pid}
    changed = True
    while changed:
        changed = False
        for pid, (ppid, _rss, _swap) in process_snapshot.items():
            if ppid in descendants and pid not in descendants:
                descendants.add(pid)
                changed = True
    process_rss = sum(process_snapshot[pid][1] for pid in descendants if pid in process_snapshot)
    process_swap = sum(process_snapshot[pid][2] for pid in descendants if pid in process_snapshot)
    mem_total = meminfo.get("MemTotal")
    mem_available = meminfo.get("MemAvailable")
    swap_total = meminfo.get("SwapTotal")
    swap_free = meminfo.get("SwapFree")
    if mem_total is not None:
        usage["system_memory_total_bytes"] = mem_total
    if swap_total is not None:
        usage["system_swap_total_bytes"] = swap_total
    usage["peak_process_tree_rss_bytes"] = max(usage.get("peak_process_tree_rss_bytes", 0), process_rss)
    usage["maximum_process_tree_swap_bytes"] = max(usage.get("maximum_process_tree_swap_bytes", 0), process_swap)
    if mem_total is not None and mem_available is not None:
        usage["peak_system_memory_used_bytes"] = max(
            usage.get("peak_system_memory_used_bytes", 0), mem_total - mem_available
        )
        usage["lowest_system_available_memory_bytes"] = min(
            usage.get("lowest_system_available_memory_bytes", mem_available), mem_available
        )
    if swap_total is not None and swap_free is not None:
        usage["maximum_system_swap_used_bytes"] = max(
            usage.get("maximum_system_swap_used_bytes", 0), swap_total - swap_free
        )
    usage["samples"] = usage.get("samples", 0) + 1


def _monitor_resources(root_pid: int, stop_event: threading.Event, usage: dict[str, Any]) -> None:
    while not stop_event.is_set():
        _sample_resource_usage(root_pid, usage)
        stop_event.wait(FEA_RESOURCE_SAMPLE_INTERVAL_SECONDS)
    _sample_resource_usage(root_pid, usage)


def _resource_log_record(
    solve_type: str,
    parameters: dict[str, Any],
    usage: dict[str, Any],
    status: str,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    strategy = parameters.get("solve_strategy", SOLVE_STRATEGY_FULL_STACK)
    reduction = {
        "solve_strategy": strategy,
        "full_stack_solved": strategy == SOLVE_STRATEGY_FULL_STACK,
        "exact_mirror_symmetry_used": strategy in {SOLVE_STRATEGY_MIRROR_HALF, SOLVE_STRATEGY_END_REPEAT_APPROX},
        "repeating_cell_approximation_used": strategy == SOLVE_STRATEGY_END_REPEAT_APPROX,
    }
    if solve_type == "thermal":
        reduction = {
            "solve_strategy": "exact_mirror_half",
            "full_stack_solved": False,
            "exact_mirror_symmetry_used": True,
            "repeating_cell_approximation_used": False,
        }
    record: dict[str, Any] = {
        "timestamp_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "solve_type": solve_type,
        "status": status,
        "resource_usage": usage,
        "geometry_and_simulation_parameters": parameters,
        "model_reduction": reduction,
    }
    if result:
        capacitance = result.get("capacitance") or {}
        record["result_summary"] = {
            "mesh": result.get("mesh") or result.get("grid", {}).get("mesh"),
            "symmetry_strategy": result.get("symmetry_strategy") or capacitance.get("symmetry_strategy"),
        }
    if error:
        record["error"] = error
    return record


def _append_resource_log(record: dict[str, Any]) -> None:
    DEFAULT_FEA_RESOURCE_LOG.parent.mkdir(parents=True, exist_ok=True)
    with FEA_RESOURCE_LOG_LOCK:
        with DEFAULT_FEA_RESOURCE_LOG.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record, separators=(",", ":")) + "\n")


def _run_monitored_fenicsx(
    solver_filename: str,
    solve_type: str,
    parameters: dict[str, Any],
    timeout_seconds: float,
) -> dict[str, Any]:
    command = [sys.executable, str(Path(__file__).with_name(solver_filename)), "--solve-stdin"]
    usage: dict[str, Any] = {
        "monitor_source": "linux-proc" if Path("/proc/meminfo").is_file() else "unavailable",
        "sample_interval_seconds": FEA_RESOURCE_SAMPLE_INTERVAL_SECONDS,
    }
    started = time.monotonic()
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stop_event = threading.Event()
    monitor = threading.Thread(target=_monitor_resources, args=(process.pid, stop_event, usage), daemon=True)
    monitor.start()
    try:
        stdout, stderr = process.communicate(input=json.dumps(parameters), timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        process.kill()
        stdout, stderr = process.communicate()
        detail = stderr.strip() or stdout.strip() or f"timed out after {timeout_seconds:g} seconds"
        error = f"{solve_type.title()} FEniCSx subprocess failed: {detail}"
        usage["duration_seconds"] = round(time.monotonic() - started, 3)
        _append_resource_log(_resource_log_record(solve_type, parameters, usage, "failed", error=error))
        raise RuntimeError(error)
    finally:
        stop_event.set()
        monitor.join(timeout=2.0)
        usage["duration_seconds"] = round(time.monotonic() - started, 3)
    try:
        if process.returncode != 0:
            detail = stderr.strip() or stdout.strip() or f"exit code {process.returncode}"
            raise RuntimeError(f"{solve_type.title()} FEniCSx subprocess failed: {detail}")
        result = json.loads(stdout)
    except Exception as exc:
        _append_resource_log(_resource_log_record(solve_type, parameters, usage, "failed", error=str(exc)))
        raise
    result["resource_usage"] = usage
    result["resource_log"] = str(DEFAULT_FEA_RESOURCE_LOG.relative_to(ROOT)).replace("\\", "/")
    _append_resource_log(_resource_log_record(solve_type, parameters, usage, "complete", result=result))
    return result


def solve_fenicsx_subprocess(parameters: dict[str, Any]) -> dict[str, Any]:
    """Run FEniCSx out-of-process so Gmsh/PETSc stay out of worker threads."""
    return _run_monitored_fenicsx(
        "fenicsx_solver.py", "electric_field", parameters, FENICSX_SUBPROCESS_TIMEOUT_SECONDS
    )


def solve_thermal_fenicsx_subprocess(parameters: dict[str, Any]) -> dict[str, Any]:
    """Run the axisymmetric thermoelastic FEniCSx model out-of-process."""
    return _run_monitored_fenicsx(
        "thermal_fenicsx_solver.py", "thermal", parameters, THERMAL_FENICSX_SUBPROCESS_TIMEOUT_SECONDS
    )


def job_payload(job: Job) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "job_id": job.job_id,
        "client_id": job.client_id,
        "status": job.status,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }
    if job.result is not None:
        payload["result"] = job.result
        payload["source"] = job.result.get("source", "fea-backend")
    if job.error is not None:
        payload["error"] = job.error
    payload["solver"] = job.solver_name
    return payload


def sanitize_field_solver(value: Any) -> str:
    if isinstance(value, str) and value in FIELD_SOLVERS:
        return value
    return SOLVER_FD


def make_handler(state: BackendState) -> type[BaseHTTPRequestHandler]:
    class FieldBackendHandler(BaseHTTPRequestHandler):
        server_version = "DiscoidalBiasFieldBackend/0.1"

        def do_OPTIONS(self) -> None:
            self.send_response(HTTPStatus.NO_CONTENT)
            self._send_common_headers()
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/api/health":
                solver_status = state.solver_status()
                source = "fea-backend-fenicsx" if solver_status["effective"] == SOLVER_FENICSX else "fea-backend-axisymmetric-fd"
                self._send_json({
                    "status": "ok",
                    "jobs": self._job_counts(),
                    "source": source,
                    "solver": solver_status,
                    "thermalSolver": thermal_fenicsx_solver.dependency_status(),
                })
                return
            if parsed.path.startswith("/api/field-solve/"):
                job_id = unquote(parsed.path.rsplit("/", 1)[-1])
                job = state.get_job(job_id)
                if job is None:
                    self._send_json({"status": "missing", "error": "Unknown job_id"}, HTTPStatus.NOT_FOUND)
                else:
                    self._send_json(job_payload(job))
                return
            self._serve_static(parsed.path)

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/api/geometry":
                try:
                    request = self._read_json_body()
                    raw_parameters = request.get("parameters", request)
                    if not isinstance(raw_parameters, dict):
                        raise ValueError("parameters must be an object")
                    parameters = sanitized_parameters(raw_parameters)
                    self._send_json(
                        {
                            "status": "ok",
                            "source": "axisymmetric-model",
                            "parameters": parameters,
                            "geometry": axisymmetric_model.geometry_summary(parameters),
                        }
                    )
                except Exception as exc:
                    self._send_json({"status": "failed", "error": str(exc)}, HTTPStatus.BAD_REQUEST)
                return
            if parsed.path == "/api/spice-ladder":
                try:
                    request = self._read_json_body()
                    raw_parameters = request.get("parameters", request)
                    if not isinstance(raw_parameters, dict):
                        raise ValueError("parameters must be an object")
                    parameters = sanitized_parameters(raw_parameters)
                    self._send_json(spice_ladder.simulate(parameters))
                except Exception as exc:
                    self._send_json({"status": "failed", "error": str(exc)}, HTTPStatus.BAD_REQUEST)
                return
            if parsed.path == "/api/thermal-solve":
                try:
                    request = self._read_json_body()
                    raw_parameters = request.get("parameters", request)
                    if not isinstance(raw_parameters, dict):
                        raise ValueError("parameters must be an object")
                    parameters = sanitized_parameters(raw_parameters)
                    self._send_json(solve_thermal_fenicsx_subprocess(parameters))
                except Exception as exc:
                    self._send_json({"status": "failed", "error": str(exc)}, HTTPStatus.BAD_REQUEST)
                return
            if parsed.path != "/api/field-solve":
                self._send_json({"error": "Unknown endpoint"}, HTTPStatus.NOT_FOUND)
                return
            try:
                request = self._read_json_body()
                raw_parameters = request.get("parameters", request)
                if not isinstance(raw_parameters, dict):
                    raise ValueError("parameters must be an object")
                job = state.submit(str(request.get("client_id", "browser")), raw_parameters, str(request.get("solver", state.solver_name)))
            except Exception as exc:
                self._send_json({"status": "failed", "error": str(exc)}, HTTPStatus.BAD_REQUEST)
                return
            self._send_json(job_payload(job), HTTPStatus.ACCEPTED)

        def log_message(self, format: str, *args: Any) -> None:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            print(f"{timestamp} {self.address_string()} {format % args}")

        def _job_counts(self) -> dict[str, int]:
            counts: dict[str, int] = {}
            with state.jobs_lock:
                for job in state.jobs.values():
                    counts[job.status] = counts.get(job.status, 0) + 1
            return counts

        def _read_json_body(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                return {}
            if length > MAX_BODY_BYTES:
                raise ValueError("request body is too large")
            body = self.rfile.read(length)
            data = json.loads(body.decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError("request body must be a JSON object")
            return data

        def _serve_static(self, request_path: str) -> None:
            relative = "index.html" if request_path in {"", "/"} else request_path.lstrip("/")
            relative = unquote(relative)
            candidate = (state.static_dir / relative).resolve()
            if candidate.is_dir():
                candidate = (candidate / "index.html").resolve()
            if not candidate.is_file() or state.static_dir not in candidate.parents:
                self._send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
                return
            content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
            data = candidate.read_bytes()
            self.send_response(HTTPStatus.OK)
            self._send_common_headers()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
            data = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self._send_common_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _send_common_headers(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")

    return FieldBackendHandler


def run_server(host: str, port: int, static_dir: Path, job_dir: Path, worker_count: int, solver_name: str) -> None:
    state = BackendState(static_dir=static_dir, job_dir=job_dir, worker_count=worker_count, solver_name=solver_name)
    server = ThreadingHTTPServer((host, port), make_handler(state))
    print(f"Serving Discoidal Capacitor Bias Filter backend on http://{host}:{port}/")
    print(f"Static web root: {static_dir}")
    print(f"Job output root: {job_dir}")
    print(f"Requested field solver: {state.solver_name}")
    print(f"Effective field solver: {state.solver_status()['effective']}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping backend.")
    finally:
        server.shutdown()
        server.server_close()
        state.stop()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the Discoidal Capacitor Bias Filter web app and field-solve API.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address. Use 0.0.0.0 on the Pi for LAN/VPN access.")
    parser.add_argument("--port", type=int, default=8765, help="HTTP port.")
    parser.add_argument("--static-dir", type=Path, default=DEFAULT_STATIC_DIR, help="Static web app directory.")
    parser.add_argument("--job-dir", type=Path, default=DEFAULT_JOB_DIR, help="Per-job output directory.")
    parser.add_argument("--workers", type=int, default=1, help="Number of solver worker threads. Keep 1 on a Raspberry Pi unless profiled.")
    parser.add_argument(
        "--solver",
        choices=sorted(FIELD_SOLVERS),
        default=SOLVER_FD,
        help="Field solver backend. 'fd' is the current screening solver; 'auto' can use FEniCSx once ready; 'fenicsx' requires the optional FEniCSx worker.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_server(args.host, args.port, args.static_dir, args.job_dir, args.workers, args.solver)


if __name__ == "__main__":
    main()
