"""CAEN output topology and independent RC-limit checks."""
import math
import unittest
from pathlib import Path
import axisymmetric_model as model
import spice_ladder as spice
from thermal_fenicsx_solver import epoxy_thermal_preset

class CaenOutputTests(unittest.TestCase):
    def setUp(self):
        self.p = model.load_parameters(model.DEFAULT_PARAMETERS)

    def test_no_cable_rc_limit(self):
        p = {**self.p, "source_cable_length_m": 0, "bias_source_divider_mohm": 0}
        for f in (50, 1/(2*math.pi*40000*1e-9), 100000):
            gain, impedance = spice.source_line_thevenin(p, f)
            expected = 1/(1+2j*math.pi*f*40000*1e-9)
            self.assertAlmostEqual(abs(gain-expected), 0, places=12)
            self.assertAlmostEqual(abs(impedance-40000*expected), 0, places=8)

    def test_pickup_is_after_supply_shunt(self):
        for length in (0, 10):
            p = {**self.p, "source_cable_length_m": length}
            c = spice.circuit_estimates(p)
            net = spice.lmfe_source_controlled_netlist(c,p,Path("unused"),regulator_source=True,pickup_node="input")
            supply = "supply" if length else "pickup_return"
            self.assertIn(f"Creg {supply} 0 1e-09", net)
            self.assertIn(f"Rdivider {supply} 0 300000000", net)
            self.assertIn("Vpickup src pickup_return DC 0 AC 1", net)

    def test_dp270_cooldown_integral(self):
        self.assertAlmostEqual(epoxy_thermal_preset(self.p)["cte_per_c"],80e-6)
        p = {**self.p,"epoxy_cure_schedule":"three_m_dp270:80"}
        self.assertAlmostEqual(epoxy_thermal_preset(p)["cte_per_c"]*60,23*80e-6+37*180e-6)

if __name__ == "__main__": unittest.main()
