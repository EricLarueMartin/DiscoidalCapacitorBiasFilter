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
NGSPICE_TIMEOUT_SECONDS = 20
ATTENUATION_SWEEP_FMIN_HZ = 1.0
ATTENUATION_SWEEP_FMAX_HZ = 100e6
INSTRUMENT_PORT_OHM = 50.0


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
    if load_mode == "transmission_line":
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
) -> str:
    stages = max(1, int(p["plate_pairs"]))
    ground_cap_pf = node_ground_capacitances_pf(circuit, stages)
    mutual_cap_pf = mutual_capacitance_matrix_pf(circuit, stages)
    input_ohm = series_resistance_ohm(p, circuit, "input")
    output_ohm = series_resistance_ohm(p, circuit, "output")
    port_caps = port_capacitance_network_pf(circuit, stages)
    filter_source_node = "src" if input_ohm > 0.0 else "n0"
    source_node = "gen" if instrument_ports else filter_source_node
    load_node = "out" if output_ohm > 0.0 else f"n{stages - 1}"
    lines = [
        "* Discoidal Capacitor Bias Filter ladder, generated by backend",
        f"V1 {source_node} 0 AC 1",
    ]
    if instrument_ports:
        lines.append(f"Rsource50 gen {filter_source_node} {INSTRUMENT_PORT_OHM:.6g}")
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
) -> str:
    base = netlist_text(
        circuit,
        p,
        include_load=include_load,
        instrument_ports=instrument_ports,
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


def ngspice_ac_sweep(
    circuit: dict[str, float],
    p: dict[str, Any],
    include_load: bool = True,
    instrument_ports: bool = False,
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


def internal_sample_rows(circuit: dict[str, float], p: dict[str, Any], frequencies: list[float]) -> list[dict[str, Any]]:
    rows = []
    for frequency in frequencies:
        full_tline = ladder_transfer(circuit, p, frequency, "transmission_line")
        full_lumped = ladder_transfer(circuit, p, frequency, "lumped")
        full_unloaded = ladder_transfer(circuit, p, frequency, "none")
        instrument_50ohm = ladder_transfer(circuit, p, frequency, "instrument_50ohm")
        scaled = scaled_stage_transfer(circuit, p, frequency)
        rows.append(sample_row(frequency, full_tline, full_lumped, full_unloaded, instrument_50ohm, scaled))
    return rows


def sample_row(
    frequency: float,
    full_tline: complex,
    full_lumped: complex,
    full_unloaded: complex,
    instrument_50ohm: complex,
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
    ngspice_samples = ngspice_result.get("samples") if ngspice_result else None
    ngspice_unloaded_samples = ngspice_unloaded_result.get("samples") if ngspice_unloaded_result else None
    ngspice_instrument_samples = ngspice_instrument_result.get("samples") if ngspice_instrument_result else None
    if ngspice_samples:
        frequencies = [frequency for frequency, _ in ngspice_samples]
        unloaded_by_frequency = dict(ngspice_unloaded_samples or [])
        instrument_by_frequency = dict(ngspice_instrument_samples or [])
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
            scaled = scaled_stage_transfer(circuit, p, frequency)
            samples.append(sample_row(frequency, full_tline, full_lumped, full_unloaded, instrument_50ohm, scaled))
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
        scaled = scaled_stage_transfer(circuit, p, frequency)
        return {
            "frequencyHz": frequency,
            "fullTlineAttenuationDb": attenuation_db(full_tline),
            "fullLumpedAttenuationDb": attenuation_db(full_lumped),
            "fullUnloadedAttenuationDb": attenuation_db(full_unloaded),
            "instrument50OhmAttenuationDb": attenuation_db(instrument_50ohm),
            "scaledStageAttenuationDb": attenuation_db(scaled),
        }

    return {
        "status": "ok",
        "source": source,
        "method": method,
        "spicePackage": spice_package,
        "spiceRuntime": ngspice_result.get("runtime") if ngspice_result else spice_runtime_status(),
        "spiceFallbackReason": ngspice_result.get("error") if ngspice_result and not ngspice_samples else None,
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
            ],
        },
        "netlist": netlist_text(circuit, p),
        "instrumentNetlist": netlist_text(circuit, p, include_load=False, instrument_ports=True),
    }
