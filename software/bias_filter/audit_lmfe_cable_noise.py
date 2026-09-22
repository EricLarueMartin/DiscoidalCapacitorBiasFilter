"""Run reproducible signal-cable and supply-impedance sensitivity on the Pi.

Each case recalibrates the charge transient and all three noise paths.
Existing FEA capacitances are reused. This does not change reference settings.
"""
import json
import math
import tempfile
from pathlib import Path

import spice_ladder as spice
from refresh_noise_reference import solve

ROOT = Path(__file__).resolve().parents[2]


def main():
    prefix = "window.DISCOIDAL_BUNDLED_DEFAULT_FIELD_RESULT = "
    bundle = json.loads((ROOT / "presentations/web/default-fenicsx-field-23lv.js").read_text()[len(prefix):].strip().removesuffix(";"))
    original_model = spice.LMFE_PICKUP_MODEL_PATH
    model = original_model.read_text()
    original_line = next(line for line in model.splitlines() if line.startswith('.model LMFE_HEAD_CABLE'))
    cases = [
        ("exported-output-10m", None, 10, 1),
        ("50ohm-pe-output-10m", 0.66, 10, 1),
        ("50ohm-kapton-output-10m", 1 / math.sqrt(3.4), 10, 1),
        ("source-0p1Mohm-output-10m", None, 10, 0.1),
        ("source-10Mohm-output-10m", None, 10, 10),
    ]
    output = ROOT / 'simulations/spice/lmfe-head-cable-noise-audit.json'
    report = {"purpose": "10 m O2/O4 output cables; O1/O3 stay 1 m. Fully filled Kapton is an unmeasured effective-permittivity scenario. Earlier signal-cable audit varied the wrong connections and is not evidence about output-cable stability.", "cases": []}
    if output.exists():
        report = json.loads(output.read_text())
    with tempfile.TemporaryDirectory(prefix='lmfe_cable_audit_') as folder:
        model_path = Path(folder) / 'variant.lib'
        try:
            for name, vf, length, source_r in cases:
                if any(item['name'] == name for item in report['cases']):
                    continue
                p = spice.axisymmetric_model.normalize_parameters({**bundle['settings'], 'bias_source_resistance_mohm': source_r})
                circuit = dict(bundle['spiceLadder']['circuit'])
                circuit['biasSourceResistanceOhm'] = source_r * 1e6
                inductance = 262.5e-9 if vf is None else 50 / (vf * spice.SPEED_OF_LIGHT_M_PER_S)
                capacitance = 93.5e-12 if vf is None else 1 / (50 * vf * spice.SPEED_OF_LIGHT_M_PER_S)
                new_line = f'.model LMFE_HEAD_CABLE LTRA(len={length} R=32.81m L={inductance:.12g} C={capacitance:.12g})'
                model_path.write_text(model.replace(original_line, new_line))
                spice.LMFE_PICKUP_MODEL_PATH = model_path
                payload = {'circuit': circuit}
                exact = {}
                for key, node in [('lmfeEverythingTransfer', None), ('lmfeInputPickupTransfer', 'input'), ('lmfeCryostatPickupTransfer', 'cryostat')]:
                    transfer = spice.ngspice_lmfe_source_sweep(circuit, p, regulator_source=True, pickup_node=node)
                    if not transfer or transfer.get('error'):
                        raise RuntimeError(f'{name} {key}: {transfer}')
                    base = transfer['netlist'].split('.control')[0]
                    points = solve(base + '.control\nac lin 1 50 50\nwrdata OUTPUT v(lmfe_out_p,lmfe_out_n)\nquit\n.endc\n.end\n')
                    assert len(points) == 1
                    exact[key] = {'magnitude': abs(points[0][1]), 'phase_deg': math.degrees(__import__('cmath').phase(points[0][1]))}
                    payload[key] = {k: v for k, v in transfer.items() if k not in {'stdout', 'stderr', 'runtime', 'netlist'}}
                signal = spice.ngspice_lmfe_signal_step(circuit, p)
                if not signal:
                    signal = {'error': 'No charge transient returned'}
                payload['lmfeSignalStep'] = {k: v for k, v in signal.items() if k not in {'runtime', 'netlist'}}
                report['cases'].append({'name': name, 'parameters': p, 'model': model.replace(original_line, new_line),
                    'length_m': length, 'capacitance_pf_per_m': capacitance * 1e12,
                    'inductance_nh_per_m': inductance * 1e9, 'exact_50hz': exact, 'payload': payload})
                output.write_text(json.dumps(report, separators=(',', ':'), allow_nan=False) + '\n')
                print(name, signal.get('error', 'saved'), flush=True)
        finally:
            spice.LMFE_PICKUP_MODEL_PATH = original_model


if __name__ == '__main__':
    main()
