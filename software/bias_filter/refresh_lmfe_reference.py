"""Recompute reference SPICE results after amplifier topology changes; reuse FEA."""
import json
from refresh_noise_reference import BUNDLE, PREFIX
import spice_ladder as spice


def main():
    bundle = json.loads(BUNDLE.read_text()[len(PREFIX):].strip().removesuffix(';'))
    result = spice.simulate(bundle['settings'], bundle['result']['capacitance']['capacitance_network'])
    for key in ('lmfeEverythingTransfer', 'lmfeInputPickupTransfer',
                'lmfeCryostatPickupTransfer', 'lmfeSignalStep'):
        if not result.get(key) or result[key].get('error'):
            raise RuntimeError(f'{key}: {result.get(key)}')
    bundle['spiceLadder'] = result
    BUNDLE.write_text(PREFIX + json.dumps(bundle, separators=(',', ':'), allow_nan=False) + ';\n')
    print('Reference SPICE refreshed with O2/O4 output cables; existing FEA reused.', flush=True)


if __name__ == '__main__':
    main()
