"""Refresh three complete noise transfers using the existing reference FEA bundle.

Run on the Pi with ngspice installed. No field solve is needed.
"""
import json
import math
import subprocess
import tempfile
from pathlib import Path

import spice_ladder as spice


ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "presentations/web/default-fenicsx-field-23lv.js"
PREFIX = "window.DISCOIDAL_BUNDLED_DEFAULT_FIELD_RESULT = "


def solve(deck: str) -> list[tuple[float, complex]]:
    with tempfile.TemporaryDirectory() as directory:
        target = Path(directory)
        output = target / "result.dat"
        circuit = target / "test.cir"
        circuit.write_text(deck.replace("OUTPUT", output.as_posix()), encoding="utf-8")
        result = subprocess.run([spice.spice_runtime_status()["ngspicePath"], "-b", str(circuit)],
                                capture_output=True, text=True, timeout=60)
        if result.returncode:
            raise RuntimeError(result.stderr or result.stdout)
        return spice.parse_ngspice_wrdata(output)


def main() -> None:
    bundle = json.loads(BUNDLE.read_text(encoding="utf-8")[len(PREFIX):].strip().removesuffix(";"))
    p = spice.axisymmetric_model.normalize_parameters(bundle["settings"])
    assert p["bias_source_resistance_mohm"] == 1, "Reference must retain provisional 1 Mohm"
    circuit = bundle["spiceLadder"]["circuit"]
    results = {}
    for key, node in [("lmfeEverythingTransfer", None), ("lmfeInputPickupTransfer", "input"),
                      ("lmfeCryostatPickupTransfer", "cryostat")]:
        result = spice.ngspice_lmfe_source_sweep(circuit, p, regulator_source=True, pickup_node=node)
        if not result or result.get("error"):
            raise RuntimeError(str(result))
        assert all(math.isfinite(row["outputGainVPerV"]) for row in result["samples"])
        results[key] = result
        print(key, len(result["samples"]), "points", flush=True)

    # Verify line capacitance against the electrically short T-network limit.
    delay = spice.source_cable_delay_s(p)
    z0 = p["source_cable_impedance_ohm"]
    ccable = delay / z0
    test = f"""Cable T-network low frequency check
V1 gen 0 AC 1
Rreg gen supply 1Meg
Tsource supply 0 src 0 Z0={z0} TD={delay}
Rin src out 10Meg
Rload out 0 10Meg
.control
ac lin 3 50 70
wrdata OUTPUT v(out)
quit
.endc
.end
"""
    cable_checks = []
    for frequency, measured in solve(test):
        shunt = 1 / (1 / 20e6 + 2j * math.pi * frequency * ccable)
        expected = shunt / (1e6 + shunt) * 0.5
        error = abs(measured - expected) / abs(expected)
        assert error < 1e-5, (frequency, error)
        cable_checks.append({"frequency_hz": frequency, "relative_complex_error": error})

    # Linearity check: simultaneous excitations equal the complex sum of the
    # separately solved sources, including their actual phase relationships.
    decks = [result["netlist"] for result in results.values()]
    single = []
    for deck in decks:
        deck = deck[:deck.index(".control")] + ".control\nac lin 3 50 70\nwrdata OUTPUT v(lmfe_out_p,lmfe_out_n)\nquit\n.endc\n.end\n"
        single.append(solve(deck))
    node = "src" if spice.series_resistance_ohm(p, circuit, "input") > 0 else "n0"
    combined_lines = decks[0][:decks[0].index(".control")].splitlines()
    combined_lines = [line.replace(f" {node} ", " input_return ")
                      if line.startswith(("Tsource ", "Rreg ")) else line for line in combined_lines]
    combined_lines = [line.replace(" cathode ", " cryostat_return ")
                      if line.startswith(("Tlmfe ", "Vlmfe", "Rlmfe")) else line for line in combined_lines]
    combined = "\n".join(combined_lines) + f"\nVexternal {node} input_return AC 1\nVinternal cathode cryostat_return AC 1\n"
    combined += ".control\nac lin 3 50 70\nwrdata OUTPUT v(lmfe_out_p,lmfe_out_n)\nquit\n.endc\n.end\n"
    superposition = []
    for index, (frequency, measured) in enumerate(solve(combined)):
        expected = sum(rows[index][1] for rows in single)
        error = abs(measured - expected) / max(abs(expected), 1e-30)
        assert error < 1e-5, (frequency, error)
        superposition.append({"frequency_hz": frequency, "relative_complex_error": error})

    bundle["spiceLadder"].update(results)
    BUNDLE.write_text(PREFIX + json.dumps(bundle, separators=(",", ":"), allow_nan=False) + ";\n", encoding="utf-8")
    output = ROOT / "simulations/spice/three-noise-sources-validation.json"
    output.write_text(json.dumps({"settings": p, "cable_capacitance_pf": ccable * 1e12,
        "t_network_checks": cable_checks, "superposition_checks": superposition,
        "supply": "CAEN model/spec pending; 1 Mohm provisional", "transfers": results}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"cable_capacitance_pf": ccable * 1e12, "t_network": cable_checks,
                      "superposition": superposition}), flush=True)


if __name__ == "__main__":
    main()
