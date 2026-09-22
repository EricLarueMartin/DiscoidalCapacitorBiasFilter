import unittest
from pathlib import Path
import json
import noise_cables
import spice_ladder as spice


class NoiseCableTests(unittest.TestCase):
    @unittest.skipUnless(spice.spice_runtime_status()['ngspicePath'], 'ngspice required')
    def test_ngspice_configured_paths(self):
        p = spice.axisymmetric_model.load_parameters(spice.axisymmetric_model.DEFAULT_PARAMETERS)
        p['noise_cables'] = {
            'source': dict(length_m=10,r_ohm_m=0.03281,l_nh_m=262.5,c_pf_m=93.5),
            'load': dict(length_m=10,r_ohm_m=0.209,l_nh_m=228,c_pf_m=99.1),
            'internal': dict(length_m=1,r_ohm_m=3.78,l_nh_m=241,c_pf_m=87),
            'head': dict(length_m=10,r_ohm_m=1.92,l_nh_m=307.5309,c_pf_m=123.01236),
        }
        circuit = spice.circuit_estimates(p)
        results = {}
        for node in (None,'input','cryostat'):
            result = spice.ngspice_lmfe_source_sweep(circuit,p,regulator_source=True,pickup_node=node)
            self.assertNotIn('error',result)
            self.assertGreater(len(result['samples']),100)
            results[str(node)] = result
        signal = spice.ngspice_lmfe_signal_step(circuit,p)
        self.assertNotIn('error',signal)
        results['signal'] = signal
        target = spice.ROOT / 'simulations/spice/configurable-cables-validation.json'
        target.write_text(json.dumps({'parameters':p,'results':results},allow_nan=False))

    def test_validation_and_bypass(self):
        c = dict(length_m=0, r_ohm_m=0, l_nh_m=250, c_pf_m=100)
        self.assertEqual(noise_cables.line('x', 'a', 'b', c), ['VxBypass a b 0'])
        with self.assertRaises(ValueError):
            noise_cables.cable({'noise_cables': {'head': {**c, 'c_pf_m': 0}}}, 'head')

    def test_all_paths_and_port_polarity(self):
        p = spice.axisymmetric_model.load_parameters(spice.axisymmetric_model.DEFAULT_PARAMETERS)
        c = dict(length_m=10, r_ohm_m=1.92, l_nh_m=307.5309, c_pf_m=123.01236)
        p['noise_cables'] = {key: c for key in ('source','load','head','internal')}
        circuit = spice.circuit_estimates(p)
        net = spice.lmfe_source_controlled_netlist(circuit,p,Path('out.dat'),regulator_source=True,pickup_node='input')
        self.assertIn('Osource supply 0 pickup_return 0 sourceModel',net)
        self.assertIn('Vpickup src pickup_return',net)
        self.assertIn('Olmfe', net)
        self.assertIn('.model LMFE_HEAD_CABLE LTRA(len=10 R=1.92',net)
        self.assertIn('OHEAD_N amp_out_n 0 outn 0 LMFE_HEAD_CABLE',net)
        self.assertIn('OFB fb_near 0 amp_out_n 0 LMFE_SIGNAL_CABLE',net)
        p['noise_cables']['head'] = {**c,'length_m':0}
        model = noise_cables.frontend_model(spice.LMFE_PICKUP_MODEL_PATH.read_text(),p)
        self.assertIn('VOHEAD_PBypass amp_out_p outp 0',model)
        self.assertNotIn('.model LMFE_HEAD_CABLE',model)


if __name__ == '__main__':
    unittest.main()
