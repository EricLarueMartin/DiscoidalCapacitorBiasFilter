"""Resolve each voltage in the reference 50 Hz supply-noise path."""
import json
import math
from pathlib import Path
import spice_ladder as spice
from refresh_noise_reference import BUNDLE, PREFIX, solve


def main():
    bundle = json.loads(BUNDLE.read_text()[len(PREFIX):].strip().removesuffix(';'))
    report = []
    for cdet in (10, 2):
        p = spice.axisymmetric_model.normalize_parameters({**bundle['settings'], 'detector_capacitance_pf': cdet})
        circuit = bundle['spiceLadder']['circuit']
        base = spice.lmfe_source_controlled_netlist(circuit,p,Path('unused'),regulator_source=True).split('.control')[0]
        values = {}
        for name, expression in [('supply','v(supply)'),('filter_input','v(src)'),('filter_output','v(out)'),
                                 ('detector_voltage','v(cathode,gate)'),('R30','v(lmfe_out_p,lmfe_out_n)')]:
            _, z = solve(base+f'.control\nac lin 1 50 50\nwrdata OUTPUT {expression}\nquit\n.endc\n.end\n')[0]
            values[name] = {'magnitude':abs(z),'real':z.real,'imag':z.imag}
        signal = bundle['spiceLadder']['lmfeSignalStep'] if cdet == 10 else spice.ngspice_lmfe_signal_step(circuit,p)
        if signal.get('error'):
            raise RuntimeError(signal['error'])
        report.append({'cdet_pf':cdet,'parameters':p,'voltages_per_source_volt':values,'signal':signal})
        target = spice.ROOT/'simulations/spice/supply-50hz-breakdown.json'
        target.write_text(json.dumps(report,allow_nan=False))
        print(cdet, values, flush=True)


if __name__ == '__main__':
    main()
