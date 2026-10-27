"""SPICE-style AC ladder model for the Discoidal Capacitor Bias Filter.

This module intentionally avoids third-party dependencies so the Pi backend can
serve the result immediately. The calculation is a modified-nodal AC solve with
the same linear components a SPICE netlist would contain: stage resistors,
stage-to-ground capacitors, bias-to-bias parasitic capacitors, a lossless coax
transmission-line input admittance, and the detector/load termination.
"""

from __future__ import annotations

import cmath
import importlib.util
import math
import noise_cables
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

try:
    from . import axisymmetric_model
except ImportError:  # Direct script execution by the Pi backend.
    import axisymmetric_model


EPS0_F_PER_MM = 8.8541878128e-15
FR4_WASHER_EPSR = 4.3
SPEED_OF_LIGHT_M_PER_S = 299_792_458.0
def _timeout_seconds_from_env(name: str, default: float) -> float:
    try:
        return max(1.0, float(os.environ.get(name, default)))
    except ValueError:
        return float(default)


NGSPICE_TIMEOUT_SECONDS = _timeout_seconds_from_env("SHV_NGSPICE_TIMEOUT_S", 20)
# The LMFE signal-step transient takes roughly 30 s on a desktop and ~2-3 min on
# a Raspberry Pi 4; 120 s silently dropped it there. 480 s keeps the whole
# /api/spice-ladder request inside the browser's 600 s SPICE timeout.
LMFE_SIGNAL_TIMEOUT_SECONDS = _timeout_seconds_from_env("SHV_LMFE_SIGNAL_TIMEOUT_S", 480)
ATTENUATION_SWEEP_FMIN_HZ = 1.0
ATTENUATION_SWEEP_FMAX_HZ = 100e6
INSTRUMENT_PORT_OHM = 50.0
LMFE_OUTPUT_CAPACITANCE_FACTORS = (0.1, 0.3, 1.0, 3.0, 10.0, 30.0, 100.0)
LMFE_RESISTANCE_STUDY_CAPACITANCE_FACTORS = (0.1, 1.0, 10.0)
LMFE_SIGNAL_REFERENCE_CHARGE_C = 1e-15
LMFE_SIGNAL_COLLECTION_TIME_S = 100e-9
LMFE_SIGNAL_STOP_S = 86e-6
LMFE_OUTPUT_RESISTANCE_CANDIDATES_OHM = (
    1.0,
    5.0,
    10.0,
    22.0,
    27.0,
    33.0,
    39.0,
    47.0,
    51.0,
    68.0,
    100.0,
    150.0,
    220.0,
    330.0,
    470.0,
    680.0,
    1_000.0,
    2_200.0,
    4_700.0,
    10_000.0,
    22_000.0,
    47_000.0,
    100_000.0,
    1_000_000.0,
)
ROOT = Path(__file__).resolve().parents[2]
LMFE_PICKUP_MODEL_PATH = ROOT / "simulations" / "spice" / "legend_lmfe_pickup.lib"


def bias_source_resistance_ohm(p: dict[str, Any]) -> float:
    return max(0.0, float(p.get("bias_source_resistance_mohm", 0.04))) * 1e6


def source_cable_delay_s(p: dict[str, Any]) -> float:
    length_m = max(0.0, float(p.get("source_cable_length_m", 10.0)))
    velocity_factor = max(1e-9, float(p.get("source_cable_velocity_factor", 0.66)))
    return length_m / (velocity_factor * SPEED_OF_LIGHT_M_PER_S)


def source_line_thevenin(p: dict[str, Any], frequency_hz: float) -> tuple[complex, complex]:
    """Return the source-line Thevenin voltage and impedance at the filter."""
    source_ohm = bias_source_resistance_ohm(p)
    shunt_y = complex(1.0 / (float(p.get("bias_source_divider_mohm", 300.0)) * 1e6) if float(p.get("bias_source_divider_mohm", 300.0)) > 0 else 0, 2 * math.pi * frequency_hz * max(0, float(p.get("bias_source_capacitance_nf", 1.0))) * 1e-9)
    source_gain = 1 / (1 + source_ohm * shunt_y)
    source_ohm *= source_gain
    z0 = max(1e-9, float(p.get("source_cable_impedance_ohm", 50.0)))
    theta = 2.0 * math.pi * frequency_hz * source_cable_delay_s(p)
    a = complex(math.cos(theta), 0.0)
    b = complex(0.0, z0 * math.sin(theta))
    c = complex(0.0, math.sin(theta) / z0)
    denominator = a + source_ohm * c
    if abs(denominator) < 1e-30:
        denominator = complex(1e-30, 0.0)
    return source_gain / denominator, (b + source_ohm * a) / denominator


def parallel_plate_capacitance_pf(epsr: float, area_mm2: float, separation_mm: float) -> float:
    if area_mm2 <= 0.0 or separation_mm <= 0.0:
        return 0.0
    return EPS0_F_PER_MM * epsr * area_mm2 / separation_mm * 1e12


def core_resistance_for_length_ohm(p: dict[str, Any], length_mm: float) -> float:
    return axisymmetric_model.core_resistance_for_length_ohm(p, length_mm)


def uses_direct_stage_circuit(p: dict[str, Any]) -> bool:
    return bool(p.get("use_direct_stage_circuit", False))


def uses_direct_stage_capacitance(p: dict[str, Any]) -> bool:
    return bool(p.get("use_direct_stage_capacitance", False))


def bias_plate_count(p: dict[str, Any]) -> int:
    return max(1, int(p["plate_pairs"]))


def additional_ground_capacitance_pf(p: dict[str, Any]) -> float:
    return max(0.0, float(p.get("additional_ground_capacitance_pf", 0.0)))


def resistive_section_count(p: dict[str, Any]) -> int:
    return max(0, int(p["plate_pairs"]) - 1)


def series_resistance_ohm(p: dict[str, Any], circuit: dict[str, float], prefix: str) -> float:
    if bool(p.get(f"{prefix}_series_matches_stage", False)):
        return max(0.0, axisymmetric_model.matched_end_series_resistance_ohm(p))
    if prefix == "output":
        if "output_series_resistance_ohm" in p:
            return max(0.0, float(p["output_series_resistance_ohm"]))
        # Compatibility with saved payloads from before output R used ohms.
        return max(0.0, float(p.get("output_series_resistance_mohm", 0.0))) * 1e6
    return max(0.0, float(p.get(f"{prefix}_series_resistance_mohm", 0.0))) * 1e6


def active_series_section_count(p: dict[str, Any], circuit: dict[str, float], include_output: bool = True) -> int:
    values = [series_resistance_ohm(p, circuit, "input")]
    values.extend([float(circuit["stageResistanceOhm"])] * resistive_section_count(p))
    if include_output:
        values.append(series_resistance_ohm(p, circuit, "output"))
    return sum(1 for value in values if math.isfinite(value) and value > 0.0)


def stage_resistance_ohm(p: dict[str, Any], bias_bias_separation_mm: float) -> float:
    return axisymmetric_model.stage_core_resistance_ohm(p)


def circuit_estimates(p: dict[str, Any]) -> dict[str, Any]:
    core_radius = float(p["core_od_mm"]) / 2.0
    ground_inner = float(p["ground_plate_inner_diameter_mm"]) / 2.0
    washer_inner, washer_outer = axisymmetric_model.washer_radial_bounds(p)
    overlap_inner = max(washer_inner, ground_inner)
    overlap_outer = min(washer_outer, float(p["hv_plate_od_mm"]) / 2.0)
    overlap_area = math.pi * max(0.0, overlap_outer**2 - overlap_inner**2)

    pair_cap_pf = parallel_plate_capacitance_pf(float(p["washer_epsr"]), overlap_area, float(p["plate_gap_mm"]))
    fr4_pair_cap_pf = parallel_plate_capacitance_pf(FR4_WASHER_EPSR, overlap_area, float(p["plate_gap_mm"]))
    geometric_shunt_cap_pf = 2.0 * pair_cap_pf
    added_ground_cap_pf = additional_ground_capacitance_pf(p)
    shunt_cap_pf = geometric_shunt_cap_pf + added_ground_cap_pf
    total_ground_cap_pf = bias_plate_count(p) * shunt_cap_pf

    bias_bias_separation = axisymmetric_model.ground_plate_thickness_mm(p) + 2.0 * float(p["plate_gap_mm"])
    ferrite_area = math.pi * core_radius**2
    core_epoxy_area = math.pi * max(0.0, ground_inner**2 - core_radius**2)
    ferrite_parasitic_pf = parallel_plate_capacitance_pf(axisymmetric_model.core_capacitance_epsr(p), ferrite_area, bias_bias_separation)
    epoxy_parasitic_pf = parallel_plate_capacitance_pf(float(p["epoxy_epsr"]), core_epoxy_area, bias_bias_separation)
    direct_parasitic_pf = float(p.get("melf_stage_parasitic_pf", 0.3))
    if int(p["plate_pairs"]) > 1:
        parasitic_pf = (
            direct_parasitic_pf
            if uses_direct_stage_capacitance(p)
            else ferrite_parasitic_pf
        ) + epoxy_parasitic_pf
    else:
        parasitic_pf = 0.0

    r_stage = stage_resistance_ohm(p, bias_bias_separation)
    return {
        "pairCapPf": pair_cap_pf,
        "geometricShuntCapPf": geometric_shunt_cap_pf,
        "additionalGroundCapacitancePf": added_ground_cap_pf,
        "shuntCapPf": shunt_cap_pf,
        "totalGroundCapPf": total_ground_cap_pf,
        "parasiticPf": parasitic_pf,
        "stageResistanceOhm": r_stage,
        "washerCapGain": pair_cap_pf / fr4_pair_cap_pf if fr4_pair_cap_pf > 0.0 else math.nan,
        "capacitanceSource": "analytical-or-entered",
    }


def circuit_with_capacitance_network(
    circuit: dict[str, Any],
    p: dict[str, Any],
    capacitance_network: dict[str, Any] | None,
) -> dict[str, Any]:
    """Apply node-resolved FEA capacitances to the ladder circuit."""
    if not isinstance(capacitance_network, dict):
        return circuit
    stages = bias_plate_count(p)
    ground_raw = capacitance_network.get(
        "node_ground_pf",
        capacitance_network.get("nodeGroundPf"),
    )
    mutual_raw = capacitance_network.get(
        "mutual_pf_matrix",
        capacitance_network.get("mutualPfMatrix"),
    )
    if not isinstance(ground_raw, list) or len(ground_raw) != stages:
        raise ValueError("FEA capacitance network node_ground_pf length does not match plate_pairs")
    if not isinstance(mutual_raw, list) or len(mutual_raw) != stages:
        raise ValueError("FEA capacitance network mutual_pf_matrix size does not match plate_pairs")

    geometric_ground_pf = [max(0.0, float(value)) for value in ground_raw]
    added_ground_pf = additional_ground_capacitance_pf(p)
    ground_pf = [value + added_ground_pf for value in geometric_ground_pf]
    mutual_pf: list[list[float]] = []
    for row in mutual_raw:
        if not isinstance(row, list) or len(row) != stages:
            raise ValueError("FEA capacitance network mutual_pf_matrix must be square")
        mutual_pf.append([max(0.0, float(value)) for value in row])
    for i in range(stages):
        mutual_pf[i][i] = 0.0
        for j in range(i + 1, stages):
            symmetric = 0.5 * (mutual_pf[i][j] + mutual_pf[j][i])
            mutual_pf[i][j] = mutual_pf[j][i] = symmetric

    adjacent_pf = [mutual_pf[index][index + 1] for index in range(stages - 1)]
    average_ground_pf = sum(ground_pf) / stages
    average_adjacent_pf = sum(adjacent_pf) / len(adjacent_pf) if adjacent_pf else 0.0
    electrical_ground_raw = capacitance_network.get("electrical_node_ground_pf")
    electrical_mutual_raw = capacitance_network.get("electrical_mutual_pf_matrix")
    electrical_count = stages + 2
    has_port_network = (
        isinstance(electrical_ground_raw, list)
        and len(electrical_ground_raw) == electrical_count
        and isinstance(electrical_mutual_raw, list)
        and len(electrical_mutual_raw) == electrical_count
        and all(isinstance(row, list) and len(row) == electrical_count for row in electrical_mutual_raw)
    )
    if has_port_network:
        electrical_ground_pf = [max(0.0, float(value)) for value in electrical_ground_raw]
        electrical_mutual_pf = [
            [max(0.0, float(value)) for value in row]
            for row in electrical_mutual_raw
        ]
        input_mutual_pf = electrical_mutual_pf[0][1:stages + 1]
        output_mutual_pf = electrical_mutual_pf[-1][1:stages + 1]
        input_output_mutual_pf = electrical_mutual_pf[0][-1]
    else:
        electrical_ground_pf = [0.0, *geometric_ground_pf, 0.0]
        electrical_mutual_pf = [[0.0 for _ in range(electrical_count)] for _ in range(electrical_count)]
        for i in range(stages):
            for j in range(stages):
                electrical_mutual_pf[i + 1][j + 1] = mutual_pf[i][j]
        input_mutual_pf = [0.0 for _ in range(stages)]
        output_mutual_pf = [0.0 for _ in range(stages)]
        input_output_mutual_pf = 0.0
    return {
        **circuit,
        "pairCapPf": (sum(geometric_ground_pf) / stages) / 2.0,
        "geometricShuntCapPf": sum(geometric_ground_pf) / stages,
        "geometricShuntCapPfByNode": geometric_ground_pf,
        "additionalGroundCapacitancePf": added_ground_pf,
        "shuntCapPf": average_ground_pf,
        "totalGroundCapPf": sum(ground_pf),
        "parasiticPf": average_adjacent_pf,
        "shuntCapPfByNode": ground_pf,
        "mutualCapPfMatrix": mutual_pf,
        "parasiticPfByAdjacentPair": adjacent_pf,
        "inputPortGroundCapPf": electrical_ground_pf[0],
        "outputPortGroundCapPf": electrical_ground_pf[-1],
        "inputPortMutualPfByBias": input_mutual_pf,
        "outputPortMutualPfByBias": output_mutual_pf,
        "inputOutputMutualPf": input_output_mutual_pf,
        "electricalNodeGroundCapPf": electrical_ground_pf,
        "electricalMutualCapPfMatrix": electrical_mutual_pf,
        "portCapacitanceSource": (
            capacitance_network.get("method", "fenicsx-capacitance-matrix")
            if has_port_network
            else "unavailable"
        ),
        "capacitanceSource": capacitance_network.get(
            "method",
            "fenicsx-capacitance-matrix",
        ),
    }


def node_ground_capacitances_pf(circuit: dict[str, Any], stages: int) -> list[float]:
    values = circuit.get("shuntCapPfByNode")
    if isinstance(values, list) and len(values) == stages:
        return [max(0.0, float(value)) for value in values]
    return [max(0.0, float(circuit["shuntCapPf"])) for _ in range(stages)]


def mutual_capacitance_matrix_pf(circuit: dict[str, Any], stages: int) -> list[list[float]]:
    values = circuit.get("mutualCapPfMatrix")
    if isinstance(values, list) and len(values) == stages:
        matrix = []
        for row in values:
            if not isinstance(row, list) or len(row) != stages:
                break
            matrix.append([max(0.0, float(value)) for value in row])
        if len(matrix) == stages:
            return matrix
    uniform = max(0.0, float(circuit["parasiticPf"]))
    matrix = [[0.0 for _ in range(stages)] for _ in range(stages)]
    for index in range(stages - 1):
        matrix[index][index + 1] = matrix[index + 1][index] = uniform
    return matrix


def port_capacitance_network_pf(circuit: dict[str, Any], stages: int) -> dict[str, Any]:
    def bias_values(key: str) -> list[float]:
        values = circuit.get(key)
        if isinstance(values, list) and len(values) == stages:
            return [max(0.0, float(value)) for value in values]
        return [0.0 for _ in range(stages)]

    return {
        "input_ground": max(0.0, float(circuit.get("inputPortGroundCapPf", 0.0))),
        "output_ground": max(0.0, float(circuit.get("outputPortGroundCapPf", 0.0))),
        "input_bias_mutual": bias_values("inputPortMutualPfByBias"),
        "output_bias_mutual": bias_values("outputPortMutualPfByBias"),
        "input_output_mutual": max(0.0, float(circuit.get("inputOutputMutualPf", 0.0))),
    }


def load_conductance_s(p: dict[str, Any]) -> float:
    current_a = max(0.0, float(p.get("load_current_na", 1.0))) * 1e-9
    voltage = abs(float(p.get("bias_voltage_v", 0.0)))
    return current_a / voltage if voltage > 0.0 else 0.0


def detector_capacitance_pf(p: dict[str, Any]) -> float:
    return max(0.0, float(p.get("detector_capacitance_pf", 10.0)))


def cable_capacitance_pf(p: dict[str, Any]) -> float:
    length_m = max(0.0, float(p.get("load_cable_length_m", 10.0)))
    z0 = max(1e-9, float(p.get("load_cable_impedance_ohm", 50.0)))
    vf = max(1e-9, float(p.get("load_cable_velocity_factor", 0.66)))
    return length_m / (z0 * vf * SPEED_OF_LIGHT_M_PER_S) * 1e12


def detector_load_admittance(p: dict[str, Any], frequency_hz: float) -> complex:
    omega = 2.0 * math.pi * frequency_hz
    return complex(load_conductance_s(p), omega * detector_capacitance_pf(p) * 1e-12)


def transmission_line_input_admittance(p: dict[str, Any], frequency_hz: float) -> complex:
    length_m = max(0.0, float(p.get("load_cable_length_m", 10.0)))
    z0 = max(1e-9, float(p.get("load_cable_impedance_ohm", 50.0)))
    vf = max(1e-9, float(p.get("load_cable_velocity_factor", 0.66)))
    y_load = detector_load_admittance(p, frequency_hz)
    if length_m <= 0.0 or frequency_hz <= 0.0:
        return y_load
    y0 = 1.0 / z0
    beta_l = 2.0 * math.pi * frequency_hz * length_m / (vf * SPEED_OF_LIGHT_M_PER_S)
    t = 1j * math.tan(beta_l)
    denominator = y0 + y_load * t
    if abs(denominator) < 1e-30:
        return complex(math.copysign(1e30, denominator.real or 1.0), 0.0)
    return y0 * (y_load + y0 * t) / denominator


def lumped_load_admittance(p: dict[str, Any], frequency_hz: float) -> complex:
    omega = 2.0 * math.pi * frequency_hz
    cap_pf = detector_capacitance_pf(p) + cable_capacitance_pf(p)
    return complex(load_conductance_s(p), omega * cap_pf * 1e-12)


def solve_complex_linear(matrix: list[list[complex]], rhs: list[complex]) -> list[complex] | None:
    n = len(rhs)
    a = [row[:] for row in matrix]
    b = rhs[:]
    for pivot in range(n):
        best = max(range(pivot, n), key=lambda row: abs(a[row][pivot]))
        if abs(a[best][pivot]) < 1e-30:
            return None
        if best != pivot:
            a[pivot], a[best] = a[best], a[pivot]
            b[pivot], b[best] = b[best], b[pivot]
        pivot_value = a[pivot][pivot]
        for col in range(pivot, n):
            a[pivot][col] /= pivot_value
        b[pivot] /= pivot_value
        for row in range(n):
            if row == pivot:
                continue
            factor = a[row][pivot]
            if abs(factor) < 1e-30:
                continue
            for col in range(pivot, n):
                a[row][col] -= factor * a[pivot][col]
            b[row] -= factor * b[pivot]
    return b


def ladder_transfer(
    circuit: dict[str, Any],
    p: dict[str, Any],
    frequency_hz: float,
    load_mode: str = "transmission_line",
) -> complex:
    stages = max(1, int(p["plate_pairs"]))
    omega = 2.0 * math.pi * frequency_hz
    ground_cap_pf = node_ground_capacitances_pf(circuit, stages)
    mutual_cap_pf = mutual_capacitance_matrix_pf(circuit, stages)
    instrument_measurement = load_mode == "instrument_50ohm"
    regulator_measurement = load_mode in {
        "regulator_input_tline",
        "regulator_input_tline_unloaded",
    }
    if load_mode in {"transmission_line", "regulator_input_tline"}:
        y_load = transmission_line_input_admittance(p, frequency_hz)
    elif load_mode == "lumped":
        y_load = lumped_load_admittance(p, frequency_hz)
    elif instrument_measurement:
        y_load = complex(1.0 / INSTRUMENT_PORT_OHM, 0.0)
    else:
        y_load = 0.0 + 0.0j

    input_ohm = series_resistance_ohm(p, circuit, "input")
    output_ohm = series_resistance_ohm(p, circuit, "output")
    port_caps = port_capacitance_network_pf(circuit, stages)
    next_node = stages
    if input_ohm > 0.0:
        input_node = next_node
        next_node += 1
    else:
        input_node = 0
    if output_ohm > 0.0:
        output_node = next_node
        next_node += 1
    else:
        output_node = stages - 1
    all_nodes = list(range(next_node))
    if regulator_measurement:
        source_voltage, source_impedance = source_line_thevenin(p, frequency_hz)
        fixed = {-1: source_voltage}
    else:
        source_impedance = 0.0 + 0.0j
        fixed = {-1: 1.0 + 0.0j} if instrument_measurement else {input_node: 1.0 + 0.0j}
    unknown_nodes = [node for node in all_nodes if node not in fixed]
    if not unknown_nodes:
        return fixed.get(output_node, 1.0 + 0.0j)
    unknown_index = {node: index for index, node in enumerate(unknown_nodes)}
    matrix = [[0.0 + 0.0j for _ in unknown_nodes] for _ in unknown_nodes]
    rhs = [0.0 + 0.0j for _ in unknown_nodes]

    def add_shunt(node: int, y: complex) -> None:
        if abs(y) <= 0.0 or node in fixed:
            return
        row = unknown_index[node]
        matrix[row][row] += y

    def add_branch(a: int, b: int, y: complex) -> None:
        if a == b or abs(y) <= 0.0:
            return
        a_row = unknown_index.get(a)
        b_row = unknown_index.get(b)
        if a_row is not None:
            matrix[a_row][a_row] += y
            if b_row is not None:
                matrix[a_row][b_row] -= y
            elif b in fixed:
                rhs[a_row] += y * fixed[b]
        if b_row is not None:
            matrix[b_row][b_row] += y
            if a_row is not None:
                matrix[b_row][a_row] -= y
            elif a in fixed:
                rhs[b_row] += y * fixed[a]

    def resistor_y(ohms: float) -> complex:
        return complex(1.0 / ohms, 0.0) if math.isfinite(ohms) and ohms > 0.0 else 0.0 + 0.0j

    for node in range(stages):
        add_shunt(node, complex(0.0, omega * ground_cap_pf[node] * 1e-12))
    add_shunt(input_node, complex(0.0, omega * port_caps["input_ground"] * 1e-12))
    add_shunt(output_node, complex(0.0, omega * port_caps["output_ground"] * 1e-12))
    if instrument_measurement:
        add_branch(input_node, -1, resistor_y(INSTRUMENT_PORT_OHM))
    elif regulator_measurement and abs(source_impedance) > 0.0:
        add_branch(input_node, -1, 1.0 / source_impedance)
    if input_ohm > 0.0:
        add_branch(input_node, 0, resistor_y(input_ohm))
    for node in range(1, stages):
        add_branch(node - 1, node, resistor_y(float(circuit["stageResistanceOhm"])))
    for i in range(stages):
        for j in range(i + 1, stages):
            add_branch(i, j, complex(0.0, omega * mutual_cap_pf[i][j] * 1e-12))
    for index in range(stages):
        add_branch(
            input_node,
            index,
            complex(0.0, omega * port_caps["input_bias_mutual"][index] * 1e-12),
        )
        add_branch(
            output_node,
            index,
            complex(0.0, omega * port_caps["output_bias_mutual"][index] * 1e-12),
        )
    add_branch(
        input_node,
        output_node,
        complex(0.0, omega * port_caps["input_output_mutual"] * 1e-12),
    )
    if output_ohm > 0.0:
        add_branch(stages - 1, output_node, resistor_y(output_ohm))
    add_shunt(output_node, y_load)

    solution = solve_complex_linear(matrix, rhs)
    if not solution:
        return complex(math.nan, math.nan)
    if output_node in fixed:
        return fixed[output_node]
    transfer = solution[unknown_index[output_node]]
    # A calibrated 50-ohm analyzer reports a matched through as 0 dB even
    # though its load receives half of the Thevenin generator voltage.
    return 2.0 * transfer if instrument_measurement else transfer


def scaled_stage_transfer(circuit: dict[str, float], p: dict[str, Any], frequency_hz: float) -> complex:
    sections = active_series_section_count(p, circuit, include_output=True)
    if sections <= 0:
        return 1.0 + 0.0j
    omega = 2.0 * math.pi * frequency_hz
    y_par = complex(
        1.0 / circuit["stageResistanceOhm"] if circuit["stageResistanceOhm"] > 0.0 else 0.0,
        omega * max(0.0, circuit["parasiticPf"]) * 1e-12,
    )
    y_ground = complex(load_conductance_s(p), omega * (circuit["shuntCapPf"] + cable_capacitance_pf(p) + detector_capacitance_pf(p)) * 1e-12)
    one_stage = y_par / (y_par + y_ground) if abs(y_par + y_ground) > 0.0 else complex(math.nan, math.nan)
    magnitude = abs(one_stage) ** sections
    phase = cmath.phase(one_stage) * sections
    return cmath.rect(magnitude, phase)


def attenuation_db(value: complex) -> float:
    magnitude = abs(value)
    if not math.isfinite(magnitude) or magnitude <= 0.0:
        return math.nan
    return -20.0 * math.log10(max(1e-300, magnitude))


def sample_frequencies(p: dict[str, Any], count: int = 161) -> list[float]:
    f_min = ATTENUATION_SWEEP_FMIN_HZ
    f_max = ATTENUATION_SWEEP_FMAX_HZ
    return [f_min * (f_max / f_min) ** (index / (count - 1)) for index in range(count)]


def netlist_text(
    circuit: dict[str, Any],
    p: dict[str, Any],
    include_load: bool = True,
    instrument_ports: bool = False,
    regulator_source: bool = False,
) -> str:
    stages = max(1, int(p["plate_pairs"]))
    ground_cap_pf = node_ground_capacitances_pf(circuit, stages)
    mutual_cap_pf = mutual_capacitance_matrix_pf(circuit, stages)
    input_ohm = series_resistance_ohm(p, circuit, "input")
    output_ohm = series_resistance_ohm(p, circuit, "output")
    port_caps = port_capacitance_network_pf(circuit, stages)
    filter_source_node = "src" if input_ohm > 0.0 else "n0"
    source_node = "gen" if instrument_ports or regulator_source else filter_source_node
    load_node = "out" if output_ohm > 0.0 else f"n{stages - 1}"
    lines = [
        "* Discoidal Capacitor Bias Filter ladder, generated by backend",
        f"V1 {source_node} 0 AC 1",
    ]
    if instrument_ports:
        lines.append(f"Rsource50 gen {filter_source_node} {INSTRUMENT_PORT_OHM:.6g}")
    elif regulator_source:
        source_ohm = bias_source_resistance_ohm(p)
        source_length = max(0.0, float(p.get("source_cable_length_m", 10.0)))
        if source_length > 0.0:
            lines.append(f"Rreg gen supply {source_ohm:.6g}")
            if noise_cables.cable(p, 'source') is not None:
                lines.extend(noise_cables.line('source', 'supply', filter_source_node, noise_cables.cable(p, 'source')))
            else:
                lines.append(
                    f"Tsource supply 0 {filter_source_node} 0 "
                    f"Z0={float(p.get('source_cable_impedance_ohm', 50.0)):.6g} "
                    f"TD={source_cable_delay_s(p):.6g}"
                )
        else:
            lines.append(f"Rreg gen {filter_source_node} {source_ohm:.6g}")
    if regulator_source:
        supply_node = "supply" if source_length > 0 else filter_source_node
        cap_nf = max(0.0, float(p.get("bias_source_capacitance_nf", 1.0)))
        divider_mohm = float(p.get("bias_source_divider_mohm", 300.0))
        if cap_nf > 0:
            lines.append(f"Creg {supply_node} 0 {cap_nf * 1e-9:.9g}")
        if divider_mohm > 0:
            lines.append(f"Rdivider {supply_node} 0 {divider_mohm * 1e6:.9g}")
    if input_ohm > 0.0:
        lines.append(f"Rin src n0 {input_ohm:.6g}")
    for stage in range(stages):
        lines.append(f"Cg{stage} n{stage} 0 {ground_cap_pf[stage] * 1e-12:.6g}")
    if port_caps["input_ground"] > 0.0:
        lines.append(f"CportInG {filter_source_node} 0 {port_caps['input_ground'] * 1e-12:.6g}")
    if port_caps["output_ground"] > 0.0:
        lines.append(f"CportOutG {load_node} 0 {port_caps['output_ground'] * 1e-12:.6g}")
    for stage in range(1, stages):
        lines.append(f"R{stage} n{stage - 1} n{stage} {circuit['stageResistanceOhm']:.6g}")
    capacitor_index = 0
    for i in range(stages):
        for j in range(i + 1, stages):
            if mutual_cap_pf[i][j] <= 0.0:
                continue
            capacitor_index += 1
            lines.append(
                f"Cpar{capacitor_index} n{i} n{j} {mutual_cap_pf[i][j] * 1e-12:.6g}"
            )
    for stage in range(stages):
        bias_node = f"n{stage}"
        if port_caps["input_bias_mutual"][stage] > 0.0 and filter_source_node != bias_node:
            lines.append(
                f"CportInBias{stage} {filter_source_node} {bias_node} "
                f"{port_caps['input_bias_mutual'][stage] * 1e-12:.6g}"
            )
        if port_caps["output_bias_mutual"][stage] > 0.0 and load_node != bias_node:
            lines.append(
                f"CportOutBias{stage} {load_node} {bias_node} "
                f"{port_caps['output_bias_mutual'][stage] * 1e-12:.6g}"
            )
    if port_caps["input_output_mutual"] > 0.0 and filter_source_node != load_node:
        lines.append(
            f"CportInOut {filter_source_node} {load_node} "
            f"{port_caps['input_output_mutual'] * 1e-12:.6g}"
        )
    if output_ohm > 0.0:
        lines.append(f"Rout n{stages - 1} out {output_ohm:.6g}")
    if instrument_ports:
        lines.append(f"Rmeasure50 {load_node} 0 {INSTRUMENT_PORT_OHM:.6g}")
    elif include_load:
        if noise_cables.cable(p, 'load') is not None:
            lines.extend(noise_cables.line('load', load_node, 'det', noise_cables.cable(p, 'load')))
        else:
            lines.append(f"Tload {load_node} 0 det 0 Z0={float(p.get('load_cable_impedance_ohm', 50.0)):.6g} TD={max(0.0, float(p.get('load_cable_length_m', 10.0))) / (max(1e-9, float(p.get('load_cable_velocity_factor', 0.66))) * SPEED_OF_LIGHT_M_PER_S):.6g}")
        lines.append(f"Cdet det 0 {detector_capacitance_pf(p) * 1e-12:.6g}")
        conductance = load_conductance_s(p)
        if conductance > 0.0:
            lines.append(f"Rload det 0 {1.0 / conductance:.6g}")
    lines.append(f".ac dec 50 {ATTENUATION_SWEEP_FMIN_HZ:.12g} {ATTENUATION_SWEEP_FMAX_HZ:.12g}")
    lines.append(".end")
    return "\n".join(lines)


def spice_runtime_status() -> dict[str, Any]:
    ngspice_path = shutil.which("ngspice")
    pyspice_available = importlib.util.find_spec("PySpice") is not None
    version = None
    if ngspice_path:
        try:
            completed = subprocess.run(
                [ngspice_path, "-v"],
                check=False,
                capture_output=True,
                text=True,
                timeout=5,
            )
            for line in (completed.stdout + completed.stderr).splitlines():
                if "ngspice-" in line:
                    version = line.strip().strip("* ")
                    break
        except Exception:
            version = None
    return {
        "ngspicePath": ngspice_path,
        "ngspiceVersion": version,
        "pyspiceAvailable": pyspice_available,
    }


def ngspice_controlled_netlist(
    circuit: dict[str, float],
    p: dict[str, Any],
    output_path: Path,
    include_load: bool = True,
    instrument_ports: bool = False,
    regulator_source: bool = False,
) -> str:
    base = netlist_text(
        circuit,
        p,
        include_load=include_load,
        instrument_ports=instrument_ports,
        regulator_source=regulator_source,
    ).splitlines()
    without_ac = [line for line in base if not line.lower().startswith(".ac ") and line.lower() != ".end"]
    stages = max(1, int(p["plate_pairs"]))
    output_node = "out" if series_resistance_ohm(p, circuit, "output") > 0.0 else f"n{stages - 1}"
    without_ac.extend(
        [
            ".control",
            "set filetype=ascii",
            f"ac dec 20 {ATTENUATION_SWEEP_FMIN_HZ:.12g} {ATTENUATION_SWEEP_FMAX_HZ:.12g}",
            f"wrdata {output_path.as_posix()} v({output_node})",
            "quit",
            ".endc",
            ".end",
        ]
    )
    return "\n".join(without_ac)


def parse_ngspice_wrdata(path: Path) -> list[tuple[float, complex]]:
    samples: list[tuple[float, complex]] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            columns = [float(value) for value in line.split()]
        except ValueError:
            continue
        if len(columns) >= 3:
            frequency = columns[0]
            real = columns[-2]
            imag = columns[-1]
            if frequency > 0.0 and math.isfinite(real) and math.isfinite(imag):
                samples.append((frequency, complex(real, imag)))
    return samples


def parse_ngspice_real_wrdata(path: Path) -> list[tuple[float, float]]:
    """Parse a real-valued ngspice wrdata transient vector."""
    samples: list[tuple[float, float]] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            columns = [float(value) for value in line.split()]
        except ValueError:
            continue
        if len(columns) >= 2:
            time_s = columns[0]
            value = columns[-1]
            if time_s >= 0.0 and math.isfinite(time_s) and math.isfinite(value):
                samples.append((time_s, value))
    return samples


def resample_real_samples(
    samples: list[tuple[float, float]],
    step_s: float,
    sample_count: int,
) -> list[tuple[float, float]]:
    """Linearly resample adaptive transient points onto a uniform time grid."""
    if not samples or step_s <= 0.0 or sample_count <= 0:
        return []
    ordered = sorted(samples)
    result: list[tuple[float, float]] = []
    upper = 1
    for index in range(sample_count):
        target = index * step_s
        while upper < len(ordered) and ordered[upper][0] < target:
            upper += 1
        if upper >= len(ordered):
            break
        if upper == 0:
            value = ordered[0][1]
        else:
            t0, v0 = ordered[upper - 1]
            t1, v1 = ordered[upper]
            if t1 <= t0:
                value = v1
            else:
                fraction = (target - t0) / (t1 - t0)
                value = v0 + fraction * (v1 - v0)
        result.append((target, value))
    return result


def ngspice_ac_sweep(
    circuit: dict[str, float],
    p: dict[str, Any],
    include_load: bool = True,
    instrument_ports: bool = False,
    regulator_source: bool = False,
) -> dict[str, Any] | None:
    status = spice_runtime_status()
    ngspice_path = status["ngspicePath"]
    if not ngspice_path:
        return None
    try:
        with tempfile.TemporaryDirectory(prefix="shv_spice_") as temp_dir:
            temp = Path(temp_dir)
            data_path = temp / "ac.dat"
            netlist_path = temp / "ladder.cir"
            netlist_path.write_text(
                ngspice_controlled_netlist(
                    circuit,
                    p,
                    data_path,
                    include_load=include_load,
                    instrument_ports=instrument_ports,
                    regulator_source=regulator_source,
                ),
                encoding="utf-8",
            )
            completed = subprocess.run(
                [ngspice_path, "-b", str(netlist_path)],
                check=False,
                capture_output=True,
                text=True,
                timeout=NGSPICE_TIMEOUT_SECONDS,
            )
            if completed.returncode != 0 or not data_path.is_file():
                return {
                    "error": (completed.stderr or completed.stdout or f"ngspice returned {completed.returncode}").strip()[-800:],
                    "runtime": status,
                }
            parsed_samples = parse_ngspice_wrdata(data_path)
            if instrument_ports:
                parsed_samples = [(frequency, 2.0 * value) for frequency, value in parsed_samples]
            return {
                "samples": parsed_samples,
                "stdout": completed.stdout[-800:],
                "stderr": completed.stderr[-800:],
                "runtime": status,
            }
    except Exception as exc:
        return {
            "error": str(exc),
            "runtime": status,
        }


def lmfe_output_cable_lines(p: dict[str, Any], output_node: str) -> list[str]:
    """Connect the filter output to the LMFE cathode with Designer cable settings."""
    if noise_cables.cable(p, 'load') is not None:
        return noise_cables.line('lmfe', output_node, 'cathode', noise_cables.cable(p, 'load'))
    length_m = max(0.0, float(p.get("load_cable_length_m", 10.0)))
    if length_m <= 0.0:
        return [f"RlmfeCableBypass {output_node} cathode 1e-9"]
    z0_ohm = max(1e-9, float(p.get("load_cable_impedance_ohm", 50.0)))
    velocity_factor = max(1e-9, float(p.get("load_cable_velocity_factor", 0.66)))
    delay_s = length_m / (velocity_factor * SPEED_OF_LIGHT_M_PER_S)
    return [f"Tlmfe {output_node} 0 cathode 0 Z0={z0_ohm:.8g} TD={delay_s:.8g}"]


def lmfe_pickup_controlled_netlist(
    circuit: dict[str, float],
    p: dict[str, Any],
    output_path: Path,
    input_path: Path,
    injection: str = "pickup",
    output_capacitance_scale: float = 1.0,
) -> str:
    """Connect the reduced LMFE model to the complete physical filter output."""
    if injection not in {"pickup", "gate"}:
        raise ValueError(f"Unknown LMFE injection: {injection}")
    output_capacitance_scale = max(0.0, float(output_capacitance_scale))
    base = netlist_text(
        circuit,
        p,
        include_load=False,
        regulator_source=True,
    ).splitlines()
    lines: list[str] = []
    stages = max(1, int(p["plate_pairs"]))
    scaled_capacitor = f"Cg{stages - 1} "
    for line in base:
        lower = line.lower()
        if lower.startswith(".ac ") or lower == ".end":
            continue
        if line.startswith("V1 "):
            fields = line.split()
            line = f"V1 {fields[1]} 0 {float(p.get('bias_voltage_v', 5000.0)):.8g} AC 0"
        elif line.startswith(scaled_capacitor):
            fields = line.split()
            fields[-1] = f"{float(fields[-1]) * output_capacitance_scale:.8g}"
            line = " ".join(fields)
        lines.append(line)
    output_node = "out" if series_resistance_ohm(p, circuit, "output") > 0.0 else f"n{stages - 1}"
    excitation = "Ipickup 0 cathode DC 0 AC 1" if injection == "pickup" else "Vgate gate 0 DC 0 AC 1"
    lines.extend(
        [
            noise_cables.frontend_model(LMFE_PICKUP_MODEL_PATH.read_text(), p),
            excitation,
            *lmfe_output_cable_lines(p, output_node),
            f"Xlmfe cathode gate lmfe_out_p lmfe_out_n LEGEND_LMFE_FRONTEND "
            f"CDET={detector_capacitance_pf(p) * 1e-12:.8g}",
            ".control",
            "set filetype=ascii",
            f"ac dec 20 {ATTENUATION_SWEEP_FMIN_HZ:.12g} {ATTENUATION_SWEEP_FMAX_HZ:.12g}",
            f"wrdata {output_path.as_posix()} v(lmfe_out_p,lmfe_out_n)",
            f"wrdata {input_path.as_posix()} v(cathode)",
            "quit",
            ".endc",
            ".end",
        ]
    )
    return "\n".join(lines)


def lmfe_source_controlled_netlist(
    circuit: dict[str, float],
    p: dict[str, Any],
    output_path: Path,
    *,
    regulator_source: bool,
    pickup_node: str | None = None,
) -> str:
    """Drive the filter source and measure the differential LMFE output."""
    base = netlist_text(
        circuit,
        p,
        include_load=False,
        regulator_source=regulator_source,
    ).splitlines()
    lines = [line for line in base if not line.lower().startswith(".ac ") and line.lower() != ".end"]
    stages = max(1, int(p["plate_pairs"]))
    output_node = "out" if series_resistance_ohm(p, circuit, "output") > 0.0 else f"n{stages - 1}"
    if pickup_node is not None:
        if not regulator_source or pickup_node not in {"input", "cryostat"}:
            raise ValueError("Pickup requires the complete regulator circuit and an input or cryostat node")
        lines = [line.replace("AC 1", "AC 0") if line.startswith("V1 ") else line for line in lines]
        node = ("src" if series_resistance_ohm(p, circuit, "input") > 0 else "n0") if pickup_node == "input" else "cathode"
        if pickup_node == "input":
            lines = [line.replace(f" {node} ", " pickup_return ")
                     if line.startswith(("Tsource ", "Osource ", "Rreg ", "Creg ", "Rdivider ")) else line for line in lines]
        lines.append(f"Vpickup {node} pickup_return DC 0 AC 1")
    cable_lines = lmfe_output_cable_lines(p, output_node)
    if pickup_node == "cryostat":
        cable_lines = [line.replace(" cathode ", " pickup_return ") for line in cable_lines]
    lines.extend(
        [
            noise_cables.frontend_model(LMFE_PICKUP_MODEL_PATH.read_text(), p),
            *cable_lines,
            f"Xlmfe cathode gate lmfe_out_p lmfe_out_n LEGEND_LMFE_FRONTEND "
            f"CDET={detector_capacitance_pf(p) * 1e-12:.8g}",
            ".control",
            "set filetype=ascii",
            f"ac dec 50 {ATTENUATION_SWEEP_FMIN_HZ:.12g} {ATTENUATION_SWEEP_FMAX_HZ:.12g}",
            f"wrdata {output_path.as_posix()} v(lmfe_out_p,lmfe_out_n)",
            "quit",
            ".endc",
            ".end",
        ]
    )
    return "\n".join(lines)


def ngspice_lmfe_source_sweep(
    circuit: dict[str, float],
    p: dict[str, Any],
    *,
    regulator_source: bool,
    pickup_node: str | None = None,
) -> dict[str, Any] | None:
    """Calculate LMFE output per volt at the filter or regulator source."""
    status = spice_runtime_status()
    ngspice_path = status["ngspicePath"]
    if not ngspice_path:
        return None
    if not LMFE_PICKUP_MODEL_PATH.is_file():
        return {"error": f"LMFE model not found: {LMFE_PICKUP_MODEL_PATH}", "runtime": status}
    try:
        with tempfile.TemporaryDirectory(prefix="lmfe_source_") as temp_dir:
            temp = Path(temp_dir)
            output_path = temp / "output.dat"
            netlist_path = temp / "lmfe-source.cir"
            netlist = lmfe_source_controlled_netlist(
                circuit,
                p,
                output_path,
                regulator_source=regulator_source,
                pickup_node=pickup_node,
            )
            netlist_path.write_text(netlist, encoding="utf-8")
            completed = subprocess.run(
                [ngspice_path, "-b", str(netlist_path)],
                check=False,
                capture_output=True,
                text=True,
                timeout=NGSPICE_TIMEOUT_SECONDS,
            )
            if completed.returncode != 0 or not output_path.is_file():
                return {
                    "error": (completed.stderr or completed.stdout or f"ngspice returned {completed.returncode}").strip()[-1200:],
                    "runtime": status,
                    "netlist": netlist,
                }
            parsed = parse_ngspice_wrdata(output_path)
            if not parsed:
                return {"error": "ngspice returned no LMFE source-transfer samples", "runtime": status, "netlist": netlist}
            return {
                "status": "ok",
                "source": f"{pickup_node}-pickup-series-voltage" if pickup_node else "regulator-internal-source" if regulator_source else "filter-input-source",
                "pickupConvention": "Localized series EMF at cable end; circuit source and load impedances retained" if pickup_node else None,
                "measurement": "differential voltage across R30 per source volt",
                "samples": [
                    {
                        "frequencyHz": frequency,
                        "outputGainVPerV": abs(output_voltage),
                        "outputPhaseDeg": math.degrees(cmath.phase(output_voltage)),
                    }
                    for frequency, output_voltage in parsed
                ],
                "runtime": status,
                "netlist": netlist,
                "stdout": completed.stdout[-800:],
                "stderr": completed.stderr[-800:],
            }
    except Exception as exc:
        return {"error": str(exc), "runtime": status}


def ngspice_lmfe_response_sweep(
    circuit: dict[str, float],
    p: dict[str, Any],
    injection: str = "pickup",
    output_capacitance_scale: float = 1.0,
    output_resistance_ohm: float | None = None,
) -> dict[str, Any] | None:
    status = spice_runtime_status()
    ngspice_path = status["ngspicePath"]
    if not ngspice_path:
        return None
    if not LMFE_PICKUP_MODEL_PATH.is_file():
        return {"error": f"LMFE model not found: {LMFE_PICKUP_MODEL_PATH}", "runtime": status}
    try:
        with tempfile.TemporaryDirectory(prefix=f"lmfe_{injection}_") as temp_dir:
            temp = Path(temp_dir)
            output_path = temp / "output.dat"
            input_path = temp / "input.dat"
            netlist_path = temp / "lmfe-pickup.cir"
            case_parameters = p
            if output_resistance_ohm is not None:
                case_parameters = {
                    **p,
                    "output_series_matches_stage": False,
                    "output_series_resistance_ohm": max(0.0, float(output_resistance_ohm)),
                }
            netlist = lmfe_pickup_controlled_netlist(
                circuit,
                case_parameters,
                output_path,
                input_path,
                injection=injection,
                output_capacitance_scale=output_capacitance_scale,
            )
            netlist_path.write_text(netlist, encoding="utf-8")
            completed = subprocess.run(
                [ngspice_path, "-b", str(netlist_path)],
                check=False,
                capture_output=True,
                text=True,
                timeout=NGSPICE_TIMEOUT_SECONDS,
            )
            if completed.returncode != 0 or not output_path.is_file() or not input_path.is_file():
                return {
                    "error": (completed.stderr or completed.stdout or f"ngspice returned {completed.returncode}").strip()[-1200:],
                    "runtime": status,
                    "netlist": netlist,
                }
            output_samples = parse_ngspice_wrdata(output_path)
            input_samples = dict(parse_ngspice_wrdata(input_path))
            if not output_samples:
                return {"error": "ngspice returned no LMFE pickup samples", "runtime": status, "netlist": netlist}
            samples = []
            for frequency, output_voltage in output_samples:
                samples.append(
                    {
                        "frequencyHz": frequency,
                        "outputMagnitude": abs(output_voltage),
                        "outputPhaseDeg": math.degrees(cmath.phase(output_voltage)),
                        "detectorNodeMagnitude": abs(input_samples.get(frequency, complex(math.nan, math.nan))),
                    }
                )
            return {
                "samples": samples,
                "injection": injection,
                "outputCapacitanceScale": output_capacitance_scale,
                "outputSeriesResistanceOhm": series_resistance_ohm(case_parameters, circuit, "output"),
                "runtime": status,
                "netlist": netlist,
                "stdout": completed.stdout[-800:],
                "stderr": completed.stderr[-800:],
            }
    except Exception as exc:
        return {"error": str(exc), "runtime": status}


def lmfe_signal_transient_netlist(
    circuit: dict[str, float],
    p: dict[str, Any],
    output_path: Path,
) -> tuple[str, dict[str, float]]:
    """Build a detector-charge transient through the complete filter and LMFE."""
    base = netlist_text(
        circuit,
        p,
        include_load=False,
        regulator_source=True,
    ).splitlines()
    lines: list[str] = []
    for line in base:
        lower = line.lower()
        if lower.startswith(".ac ") or lower == ".end":
            continue
        if line.startswith("V1 "):
            fields = line.split()
            line = f"V1 {fields[1]} 0 {float(p.get('bias_voltage_v', 5000.0)):.8g} AC 0"
        lines.append(line)

    stages = max(1, int(p["plate_pairs"]))
    output_node = "out" if series_resistance_ohm(p, circuit, "output") > 0.0 else f"n{stages - 1}"
    sample_rate_hz = max(1e6, float(p.get("noise_sample_rate_msps", 62.5)) * 1e6)
    output_step_s = 1.0 / sample_rate_hz
    stop_s = LMFE_SIGNAL_STOP_S
    sample_count = math.ceil(stop_s / output_step_s) + 1
    delay_s = 2e-6
    edge_s = 1e-9
    flat_s = max(1e-9, LMFE_SIGNAL_COLLECTION_TIME_S - edge_s)
    current_a = LMFE_SIGNAL_REFERENCE_CHARGE_C / LMFE_SIGNAL_COLLECTION_TIME_S
    max_step_s = min(output_step_s, LMFE_SIGNAL_COLLECTION_TIME_S / 10.0)
    lines.extend(
        [
            noise_cables.frontend_model(LMFE_PICKUP_MODEL_PATH.read_text(), p),
            f"Isignal cathode gate PULSE(0 {current_a:.12g} {delay_s:.12g} {edge_s:.12g} {edge_s:.12g} {flat_s:.12g} {stop_s * 2.0:.12g})",
            *lmfe_output_cable_lines(p, output_node),
            f"Xlmfe cathode gate lmfe_out_p lmfe_out_n LEGEND_LMFE_FRONTEND "
            f"CDET={detector_capacitance_pf(p) * 1e-12:.8g}",
            ".control",
            "set filetype=ascii",
            f"tran {output_step_s:.12g} {stop_s:.12g} 0 {max_step_s:.12g}",
            f"wrdata {output_path.as_posix()} v(lmfe_out_p,lmfe_out_n)",
            "quit",
            ".endc",
            ".end",
        ]
    )
    metadata = {
        "referenceChargeC": LMFE_SIGNAL_REFERENCE_CHARGE_C,
        "collectionTimeS": LMFE_SIGNAL_COLLECTION_TIME_S,
        "delayS": delay_s,
        "sampleRateHz": sample_rate_hz,
        "sampleCount": sample_count,
    }
    return "\n".join(lines), metadata


def ngspice_lmfe_signal_step(circuit: dict[str, float], p: dict[str, Any]) -> dict[str, Any] | None:
    """Simulate the R30 step produced by a known collected detector charge."""
    status = spice_runtime_status()
    ngspice_path = status["ngspicePath"]
    if not ngspice_path:
        return None
    if not LMFE_PICKUP_MODEL_PATH.is_file():
        return {"error": f"LMFE model not found: {LMFE_PICKUP_MODEL_PATH}", "runtime": status}
    try:
        with tempfile.TemporaryDirectory(prefix="lmfe_signal_") as temp_dir:
            temp = Path(temp_dir)
            output_path = temp / "signal-step.dat"
            netlist_path = temp / "lmfe-signal-step.cir"
            netlist, metadata = lmfe_signal_transient_netlist(circuit, p, output_path)
            netlist_path.write_text(netlist, encoding="utf-8")
            completed = subprocess.run(
                [ngspice_path, "-b", str(netlist_path)],
                check=False,
                capture_output=True,
                text=True,
                timeout=LMFE_SIGNAL_TIMEOUT_SECONDS,
            )
            if completed.returncode != 0 or not output_path.is_file():
                return {
                    "error": (completed.stderr or completed.stdout or f"ngspice returned {completed.returncode}").strip()[-1200:],
                    "runtime": status,
                    "netlist": netlist,
                }
            adaptive_samples = parse_ngspice_real_wrdata(output_path)
            if not adaptive_samples:
                return {"error": "ngspice returned no LMFE signal-step samples", "runtime": status, "netlist": netlist}
            if adaptive_samples[-1][0] < 0.999 * LMFE_SIGNAL_STOP_S:
                return {
                    "error": f"ngspice LMFE signal-step stopped early at {adaptive_samples[-1][0]:.8g} s",
                    "stdout": completed.stdout[-4000:],
                    "stderr": completed.stderr[-4000:],
                    "runtime": status,
                    "netlist": netlist,
                }
            samples = resample_real_samples(
                adaptive_samples,
                1.0 / metadata["sampleRateHz"],
                metadata["sampleCount"],
            )
            return {
                "status": "ok",
                "method": "ngspice-transient-known-charge",
                "injection": "detector charge current from cathode to J2 gate",
                "measurement": "differential voltage across R30",
                "feedbackCapacitancePf": 0.35,
                **metadata,
                "samples": [[time_s, value] for time_s, value in samples],
                "runtime": status,
                "netlist": netlist,
            }
    except Exception as exc:
        return {"error": str(exc), "runtime": status}


def merge_lmfe_excitation_samples(
    pickup: dict[str, Any],
    gate: dict[str, Any],
) -> list[dict[str, float]]:
    gate_by_frequency = {sample["frequencyHz"]: sample for sample in gate["samples"]}
    merged = []
    for pickup_sample in pickup["samples"]:
        frequency = pickup_sample["frequencyHz"]
        gate_sample = gate_by_frequency.get(frequency)
        if not gate_sample:
            continue
        transimpedance = pickup_sample["outputMagnitude"]
        gate_gain = gate_sample["outputMagnitude"]
        merged.append(
            {
                "frequencyHz": frequency,
                "pickupTransimpedanceOhm": transimpedance,
                "pickupTransimpedanceDbOhm": 20.0 * math.log10(max(transimpedance, 1e-300)),
                "gateSignalGainVPerV": gate_gain,
                "gateSignalGainDb": 20.0 * math.log10(max(gate_gain, 1e-300)),
                "inputReferredOhm": transimpedance / max(gate_gain, 1e-300),
                "detectorNodeImpedanceOhm": pickup_sample["detectorNodeMagnitude"],
            }
        )
    return merged


def ngspice_lmfe_capacitance_study(circuit: dict[str, float], p: dict[str, Any]) -> dict[str, Any] | None:
    if not spice_runtime_status()["ngspicePath"]:
        return None
    stages = max(1, int(p["plate_pairs"]))
    base_capacitance_pf = node_ground_capacitances_pf(circuit, stages)[-1]
    cases = []
    reference_netlists: dict[str, str | None] = {"pickup": None, "gate": None}
    for factor in LMFE_OUTPUT_CAPACITANCE_FACTORS:
        pickup = ngspice_lmfe_response_sweep(circuit, p, "pickup", factor)
        gate = ngspice_lmfe_response_sweep(circuit, p, "gate", factor)
        if not pickup or not gate or pickup.get("error") or gate.get("error"):
            return {
                "error": (pickup or {}).get("error") or (gate or {}).get("error") or "LMFE response unavailable",
                "runtime": (pickup or gate or {}).get("runtime"),
            }
        merged = merge_lmfe_excitation_samples(pickup, gate)
        if factor == 1.0:
            reference_netlists = {"pickup": pickup.get("netlist"), "gate": gate.get("netlist")}
        cases.append(
            {
                "outputCapacitanceScale": factor,
                "outputStageCapacitancePf": base_capacitance_pf * factor,
                "samples": merged,
            }
        )
    return {
        "status": "ok",
        "method": "ngspice-batch-ac-dual-excitation",
        "terminationModel": "complete-filter-rout-before-cable-cg-on-final-bias-node",
        "baseOutputStageCapacitancePf": base_capacitance_pf,
        "outputSeriesResistanceOhm": series_resistance_ohm(p, circuit, "output"),
        "detectorCapacitancePf": detector_capacitance_pf(p),
        "cableImpedanceOhm": max(1e-9, float(p.get("load_cable_impedance_ohm", 50.0))),
        "cases": cases,
        "pickupNetlist": portable_lmfe_netlist(reference_netlists["pickup"]),
        "gateNetlist": portable_lmfe_netlist(reference_netlists["gate"]),
    }


def ngspice_lmfe_resistance_study(circuit: dict[str, float], p: dict[str, Any]) -> dict[str, Any] | None:
    """Sweep filter-end termination resistance at three output capacitances."""
    if not spice_runtime_status()["ngspicePath"]:
        return None
    stages = max(1, int(p["plate_pairs"]))
    base_capacitance_pf = node_ground_capacitances_pf(circuit, stages)[-1]
    cases = []
    for capacitance_factor in LMFE_RESISTANCE_STUDY_CAPACITANCE_FACTORS:
        for resistance_ohm in LMFE_OUTPUT_RESISTANCE_CANDIDATES_OHM:
            pickup = ngspice_lmfe_response_sweep(
                circuit,
                p,
                "pickup",
                capacitance_factor,
                resistance_ohm,
            )
            gate = ngspice_lmfe_response_sweep(
                circuit,
                p,
                "gate",
                capacitance_factor,
                resistance_ohm,
            )
            if not pickup or not gate or pickup.get("error") or gate.get("error"):
                return {
                    "error": (pickup or {}).get("error") or (gate or {}).get("error") or "LMFE response unavailable",
                    "runtime": (pickup or gate or {}).get("runtime"),
                }
            cases.append(
                {
                    "outputCapacitanceScale": capacitance_factor,
                    "outputStageCapacitancePf": base_capacitance_pf * capacitance_factor,
                    "outputSeriesResistanceOhm": resistance_ohm,
                    "samples": merge_lmfe_excitation_samples(pickup, gate),
                }
            )
    return {
        "status": "ok",
        "method": "ngspice-batch-ac-dual-excitation-resistance-sweep",
        "terminationModel": "complete-filter-rout-before-cable-cg-on-final-bias-node",
        "baseOutputStageCapacitancePf": base_capacitance_pf,
        "designOutputSeriesResistanceOhm": series_resistance_ohm(p, circuit, "output"),
        "detectorCapacitancePf": detector_capacitance_pf(p),
        "cableImpedanceOhm": max(1e-9, float(p.get("load_cable_impedance_ohm", 50.0))),
        "capacitanceFactors": list(LMFE_RESISTANCE_STUDY_CAPACITANCE_FACTORS),
        "resistanceCandidatesOhm": list(LMFE_OUTPUT_RESISTANCE_CANDIDATES_OHM),
        "cases": cases,
    }


def portable_lmfe_netlist(netlist: str | None) -> str | None:
    """Remove host-specific paths from an exported diagnostic netlist."""
    if not netlist:
        return netlist
    portable = []
    for line in netlist.splitlines():
        if line.lower().startswith(".include "):
            portable.append('.include "simulations/spice/legend_lmfe_pickup.lib"')
        elif line.lower().startswith("wrdata ") and "output.dat" in line:
            portable.append("wrdata lmfe_pickup_output.dat v(lmfe_out_p,lmfe_out_n)")
        elif line.lower().startswith("wrdata ") and "input.dat" in line:
            portable.append("wrdata lmfe_pickup_input.dat v(cathode)")
        else:
            portable.append(line)
    return "\n".join(portable)


def internal_sample_rows(circuit: dict[str, float], p: dict[str, Any], frequencies: list[float]) -> list[dict[str, Any]]:
    rows = []
    for frequency in frequencies:
        full_tline = ladder_transfer(circuit, p, frequency, "transmission_line")
        full_lumped = ladder_transfer(circuit, p, frequency, "lumped")
        full_unloaded = ladder_transfer(circuit, p, frequency, "none")
        instrument_50ohm = ladder_transfer(circuit, p, frequency, "instrument_50ohm")
        regulator_input_tline = ladder_transfer(circuit, p, frequency, "regulator_input_tline")
        regulator_input_tline_unloaded = ladder_transfer(
            circuit,
            p,
            frequency,
            "regulator_input_tline_unloaded",
        )
        scaled = scaled_stage_transfer(circuit, p, frequency)
        rows.append(sample_row(
            frequency,
            full_tline,
            full_lumped,
            full_unloaded,
            instrument_50ohm,
            regulator_input_tline,
            regulator_input_tline_unloaded,
            scaled,
        ))
    return rows


def sample_row(
    frequency: float,
    full_tline: complex,
    full_lumped: complex,
    full_unloaded: complex,
    instrument_50ohm: complex,
    regulator_input_tline: complex,
    regulator_input_tline_unloaded: complex,
    scaled: complex,
) -> dict[str, Any]:
    return {
        "frequencyHz": frequency,
        "fullTline": {
            "magnitude": abs(full_tline),
            "attenuationDb": attenuation_db(full_tline),
            "phaseDeg": math.degrees(cmath.phase(full_tline)) if math.isfinite(abs(full_tline)) else math.nan,
        },
        "fullLumped": {
            "magnitude": abs(full_lumped),
            "attenuationDb": attenuation_db(full_lumped),
            "phaseDeg": math.degrees(cmath.phase(full_lumped)) if math.isfinite(abs(full_lumped)) else math.nan,
        },
        "fullUnloaded": {
            "magnitude": abs(full_unloaded),
            "attenuationDb": attenuation_db(full_unloaded),
            "phaseDeg": math.degrees(cmath.phase(full_unloaded)) if math.isfinite(abs(full_unloaded)) else math.nan,
        },
        "instrument50Ohm": {
            "magnitude": abs(instrument_50ohm),
            "attenuationDb": attenuation_db(instrument_50ohm),
            "phaseDeg": math.degrees(cmath.phase(instrument_50ohm)) if math.isfinite(abs(instrument_50ohm)) else math.nan,
        },
        "regulatorInputTline": {
            "magnitude": abs(regulator_input_tline),
            "attenuationDb": attenuation_db(regulator_input_tline),
            "phaseDeg": math.degrees(cmath.phase(regulator_input_tline)) if math.isfinite(abs(regulator_input_tline)) else math.nan,
        },
        "regulatorInputUnloaded": {
            "magnitude": abs(regulator_input_tline_unloaded),
            "attenuationDb": attenuation_db(regulator_input_tline_unloaded),
            "phaseDeg": math.degrees(cmath.phase(regulator_input_tline_unloaded)) if math.isfinite(abs(regulator_input_tline_unloaded)) else math.nan,
        },
        "scaledStage": {
            "magnitude": abs(scaled),
            "attenuationDb": attenuation_db(scaled),
            "phaseDeg": math.degrees(cmath.phase(scaled)) if math.isfinite(abs(scaled)) else math.nan,
        },
    }


def simulate(
    parameters: dict[str, Any],
    capacitance_network: dict[str, Any] | None = None,
) -> dict[str, Any]:
    p = axisymmetric_model.normalize_parameters(parameters)
    circuit = circuit_with_capacitance_network(
        circuit_estimates(p),
        p,
        capacitance_network,
    )
    ngspice_result = ngspice_ac_sweep(circuit, p, include_load=True)
    ngspice_unloaded_result = ngspice_ac_sweep(circuit, p, include_load=False)
    ngspice_instrument_result = ngspice_ac_sweep(
        circuit,
        p,
        include_load=False,
        instrument_ports=True,
    )
    ngspice_regulator_result = ngspice_ac_sweep(
        circuit,
        p,
        include_load=True,
        regulator_source=True,
    )
    ngspice_regulator_unloaded_result = ngspice_ac_sweep(
        circuit,
        p,
        include_load=False,
        regulator_source=True,
    )
    lmfe_filter_input_result = ngspice_lmfe_source_sweep(
        circuit,
        p,
        regulator_source=False,
    )
    lmfe_everything_result = ngspice_lmfe_source_sweep(
        circuit,
        p,
        regulator_source=True,
    )
    lmfe_study = ngspice_lmfe_capacitance_study(circuit, p)
    lmfe_input_pickup = ngspice_lmfe_source_sweep(circuit, p, regulator_source=True, pickup_node="input")
    lmfe_cryostat_pickup = ngspice_lmfe_source_sweep(circuit, p, regulator_source=True, pickup_node="cryostat")
    lmfe_resistance_study = ngspice_lmfe_resistance_study(circuit, p)
    lmfe_signal_step = ngspice_lmfe_signal_step(circuit, p)
    ngspice_samples = ngspice_result.get("samples") if ngspice_result else None
    ngspice_unloaded_samples = ngspice_unloaded_result.get("samples") if ngspice_unloaded_result else None
    ngspice_instrument_samples = ngspice_instrument_result.get("samples") if ngspice_instrument_result else None
    ngspice_regulator_samples = ngspice_regulator_result.get("samples") if ngspice_regulator_result else None
    ngspice_regulator_unloaded_samples = (
        ngspice_regulator_unloaded_result.get("samples")
        if ngspice_regulator_unloaded_result
        else None
    )
    lmfe_reference_case = next(
        (
            case
            for case in (lmfe_study.get("cases", []) if lmfe_study else [])
            if float(case.get("outputCapacitanceScale", 0.0)) == 1.0
        ),
        None,
    )
    lmfe_reference_ohm = max(
        [sample["pickupTransimpedanceOhm"] for sample in (lmfe_reference_case or {}).get("samples", [])]
        or [0.0]
    )
    lmfe_pickup_samples = {}
    for sample in (lmfe_reference_case or {}).get("samples", []):
        normalized = sample["pickupTransimpedanceOhm"] / max(lmfe_reference_ohm, 1e-300)
        lmfe_pickup_samples[sample["frequencyHz"]] = {
            "frequencyHz": sample["frequencyHz"],
            "transimpedanceOhm": sample["pickupTransimpedanceOhm"],
            "transimpedanceDbOhm": sample["pickupTransimpedanceDbOhm"],
            "normalizedMagnitude": normalized,
            "normalizedAttenuationDb": max(0.0, -20.0 * math.log10(max(normalized, 1e-300))),
            "detectorNodeImpedanceOhm": sample["detectorNodeImpedanceOhm"],
        }
    if ngspice_samples:
        frequencies = [frequency for frequency, _ in ngspice_samples]
        unloaded_by_frequency = dict(ngspice_unloaded_samples or [])
        instrument_by_frequency = dict(ngspice_instrument_samples or [])
        regulator_by_frequency = dict(ngspice_regulator_samples or [])
        regulator_unloaded_by_frequency = dict(ngspice_regulator_unloaded_samples or [])
        samples = []
        for frequency, full_tline in ngspice_samples:
            full_lumped = ladder_transfer(circuit, p, frequency, "lumped")
            full_unloaded = unloaded_by_frequency.get(
                frequency,
                ladder_transfer(circuit, p, frequency, "none"),
            )
            instrument_50ohm = instrument_by_frequency.get(
                frequency,
                ladder_transfer(circuit, p, frequency, "instrument_50ohm"),
            )
            regulator_input_tline = regulator_by_frequency.get(
                frequency,
                ladder_transfer(circuit, p, frequency, "regulator_input_tline"),
            )
            regulator_input_tline_unloaded = regulator_unloaded_by_frequency.get(
                frequency,
                ladder_transfer(circuit, p, frequency, "regulator_input_tline_unloaded"),
            )
            scaled = scaled_stage_transfer(circuit, p, frequency)
            samples.append(sample_row(
                frequency,
                full_tline,
                full_lumped,
                full_unloaded,
                instrument_50ohm,
                regulator_input_tline,
                regulator_input_tline_unloaded,
                scaled,
            ))
            if frequency in lmfe_pickup_samples:
                samples[-1]["lmfePickup"] = lmfe_pickup_samples[frequency]
        source = "ngspice-ac"
        method = "ngspice-batch-ac"
        spice_package = ngspice_result["runtime"]["ngspiceVersion"] or "ngspice"
    else:
        frequencies = sample_frequencies(p)
        samples = internal_sample_rows(circuit, p, frequencies)
        source = "backend-spice-style-mna"
        method = "internal-spice-style-ac-mna"
        spice_package = None

    def at_frequency(frequency: float) -> dict[str, Any]:
        full_tline = ladder_transfer(circuit, p, frequency, "transmission_line")
        full_lumped = ladder_transfer(circuit, p, frequency, "lumped")
        full_unloaded = ladder_transfer(circuit, p, frequency, "none")
        instrument_50ohm = ladder_transfer(circuit, p, frequency, "instrument_50ohm")
        regulator_input_tline = ladder_transfer(circuit, p, frequency, "regulator_input_tline")
        regulator_input_tline_unloaded = ladder_transfer(
            circuit,
            p,
            frequency,
            "regulator_input_tline_unloaded",
        )
        scaled = scaled_stage_transfer(circuit, p, frequency)
        return {
            "frequencyHz": frequency,
            "fullTlineAttenuationDb": attenuation_db(full_tline),
            "fullLumpedAttenuationDb": attenuation_db(full_lumped),
            "fullUnloadedAttenuationDb": attenuation_db(full_unloaded),
            "instrument50OhmAttenuationDb": attenuation_db(instrument_50ohm),
            "regulatorInputTlineAttenuationDb": attenuation_db(regulator_input_tline),
            "regulatorInputUnloadedAttenuationDb": attenuation_db(regulator_input_tline_unloaded),
            "scaledStageAttenuationDb": attenuation_db(scaled),
        }

    return {
        "status": "ok",
        "source": source,
        "method": method,
        "spicePackage": spice_package,
        "spiceRuntime": ngspice_result.get("runtime") if ngspice_result else spice_runtime_status(),
        "spiceFallbackReason": ngspice_result.get("error") if ngspice_result and not ngspice_samples else None,
        "lmfePickupStatus": "ngspice-ac" if lmfe_pickup_samples else "unavailable",
        "lmfePickupError": lmfe_study.get("error") if lmfe_study and not lmfe_pickup_samples else None,
        "parameters": p,
        "circuit": {
            **circuit,
            "stages": bias_plate_count(p),
            "internalResistiveSections": resistive_section_count(p),
            "resistiveSections": active_series_section_count(p, circuit, include_output=True),
            "inputSeriesResistanceOhm": series_resistance_ohm(p, circuit, "input"),
            "outputSeriesResistanceOhm": series_resistance_ohm(p, circuit, "output"),
            "loadConductanceS": load_conductance_s(p),
            "cableCapPf": cable_capacitance_pf(p),
            "detectorCapPf": detector_capacitance_pf(p),
            "loadCapPfLumped": cable_capacitance_pf(p) + detector_capacitance_pf(p),
            "cableDelayS": max(0.0, float(p.get("load_cable_length_m", 10.0))) / (max(1e-9, float(p.get("load_cable_velocity_factor", 0.66))) * SPEED_OF_LIGHT_M_PER_S),
            "cableZ0Ohm": max(1e-9, float(p.get("load_cable_impedance_ohm", 50.0))),
            "instrumentSourceOhm": INSTRUMENT_PORT_OHM,
            "instrumentLoadOhm": INSTRUMENT_PORT_OHM,
            "biasSourceResistanceOhm": bias_source_resistance_ohm(p),
            "biasSourceCapacitanceNf": float(p.get("bias_source_capacitance_nf", 1.0)),
            "biasSourceDividerMohm": float(p.get("bias_source_divider_mohm", 300.0)),
            "sourceCableLengthM": max(0.0, float(p.get("source_cable_length_m", 10.0))),
            "sourceCableDelayS": source_cable_delay_s(p),
            "sourceCableZ0Ohm": max(1e-9, float(p.get("source_cable_impedance_ohm", 50.0))),
            "sourceCableVelocityFactor": max(1e-9, float(p.get("source_cable_velocity_factor", 0.66))),
        },
        "samples": samples,
        "summary": {
            "at50Hz": at_frequency(50.0),
            "atRfCompare": at_frequency((10.0 ** float(p.get("rf_compare_frequency_log10_mhz", 0.0))) * 1e6),
            "notes": [
                "Uses ngspice batch AC analysis when available; otherwise falls back to the same AC MNA equations that a small-signal SPICE deck would solve.",
                "The coax is represented as a lossless transmission-line input admittance terminated by detector capacitance and DC-load conductance.",
                "The unloaded full-ladder curve removes the load conductance, cable, and detector capacitance, but retains the physical output terminal and its configured end resistance, then measures that terminal with infinite input impedance.",
                "When an exact FEniCSx Maxwell matrix is available, both physical end terminals retain their direct capacitance to ground and every mutual capacitance to the bias plates and opposite terminal.",
                "The 50-ohm instrument curve adds an external 50-ohm tracking-generator source and a 50-ohm analyzer load without changing the filter's configured input resistance; 2*Vload/Vsource normalization makes a matched through read 0 dB.",
                "The regulator-to-filter curve uses the Designer high-voltage regulator output resistance, a lossless source coax, the configured filter input resistor, and an unloaded physical filter output. It is normalized to the regulator's ideal internal noise voltage.",
                "The LMFE pickup curve injects a 1 A AC current at the detector cathode of the reduced LEGEND front-end model, uses the selected detector capacitance as C19, and connects the 10 m HV cable to the complete filter output. Its plotted response is normalized to the peak transimpedance in the sweep so it can share the attenuation axis without confusing V/A with V/V.",
                "Separate source-driven LMFE sweeps start either at the filter input or at the regulator's ideal internal source and measure the differential front-end output. The browser applies the selected trapezoidal response and known-charge signal calibration.",
            ],
        },
        "netlist": netlist_text(circuit, p),
        "instrumentNetlist": netlist_text(circuit, p, include_load=False, instrument_ports=True),
        "regulatorInputNetlist": netlist_text(circuit, p, include_load=True, regulator_source=True),
        "regulatorInputUnloadedNetlist": netlist_text(circuit, p, include_load=False, regulator_source=True),
        "lmfePickupNetlist": lmfe_study.get("pickupNetlist") if lmfe_study else None,
        "lmfeGateSignalNetlist": lmfe_study.get("gateNetlist") if lmfe_study else None,
        "lmfePickupReferenceTransimpedanceOhm": lmfe_reference_ohm or None,
        "lmfeOutputCapacitanceStudy": lmfe_study,
        "lmfeOutputResistanceStudy": lmfe_resistance_study,
        "lmfeSignalStep": lmfe_signal_step,
        "lmfeFilterInputTransfer": lmfe_filter_input_result,
        "lmfeEverythingTransfer": lmfe_everything_result,
        "lmfeInputPickupTransfer": lmfe_input_pickup,
        "lmfeCryostatPickupTransfer": lmfe_cryostat_pickup,
    }
