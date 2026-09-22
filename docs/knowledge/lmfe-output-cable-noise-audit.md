# Amplifier Output Cable and 50 Hz Noise Audit

## Topology Correction (2026-09-10)

The user confirmed 10 m connections to the head electronics. The exported
`LEGEND-200_LMFE_CC4_Simplified.net` contains O2/O4, two 10 m output
transmission lines terminating at the differential 100 ohm R30. O1/O3 are
separate 1 m internal signal/feedback connections. Feedback is taken before
O2/O4. The reduced ngspice model previously omitted O2/O4; it now includes them.

The first audit incorrectly lengthened O1/O3. Its 5 m and 10 m transient
failures are retained in `simulations/spice/lmfe-cable-noise-audit.json`, but
are NOT evidence that the actual 10 m output circuit is unstable. The corrected
audit is `lmfe-head-cable-noise-audit.json`; all five charge transients completed.

## Calculation and Results

Each case solves three independent voltage-noise paths (supply, input-cable
pickup, cryostat-cable pickup) to R30, then recalibrates with a 1 fC detector
charge pulse and the selected digital trapezoid. Reference settings are a
10 us rise, 4 us flat top, and 62.5 MHz sampling. Equivalent charge is the
shaped output RMS divided by the shaped voltage per unit detector charge.
Do not equate a reduction in output noise alone with better energy resolution.

For the 50 Hz check, assume the full 10 mV peak-to-peak low-frequency supply
ripple allowance is one sinusoid. Its RMS is 10 mV/(2 sqrt(2)); this is a
scenario, not a measured 50 Hz spectral line or an arbitrary-waveform bound.

| Output cable scenario | C per length | Shaped mV/fC | Supply 50 Hz ENC, electrons RMS |
| --- | ---: | ---: | ---: |
| Exported netlist, 10 m each | 93.5 pF/m | 1.46169 | 36.324 |
| 50 ohm, velocity factor 0.66 | 101.08 pF/m | 1.46058 | 36.351 |
| 50 ohm, effective permittivity 3.4 | 123.01 pF/m | 1.46678 | 36.198 |

All rows use the provisional 1 Mohm supply output resistance. Calculated Fano
noise is 280.90 electrons RMS, with the 10% allocation at 28.09 electrons RMS.
Thus this modeled supply line alone exceeds the allocation, at approximately
12.9% of Fano sigma (107.5 eV RMS). This is not total detector resolution.

With exported output cables, changing supply resistance from 0.1 to 1 to
10 Mohm gives 39.290, 36.324, and 11.108 electrons RMS respectively. This
unknown is more important here than the output dielectric scenario. The
two-band supply envelope calculation gives 151.85, 76.47, and 11.46 electrons
RMS respectively; do not add the separate 50 Hz illustration to that envelope.

The provisional cryostat pickup model gives about 652 electrons RMS in the
reference case. Its amplitude, spectrum and coupling location are unmeasured;
this is a sensitivity estimate, not evidence of actual detector noise.

## Checks and Limits

- Direct discrete convolution of a unit-RMS 50 Hz sine with the two moving
  average windows agrees with the implemented trapezoid magnitude to 7e-16
  relative error. Exact 50 Hz SPICE samples agree with the interpolated budget
  to better than 0.002% for all five cases.
- At fixed Z0, C'=1/(Z0 v) and L'=Z0/v. The Kapton scenario changes both;
  capacitance scales as sqrt(effective permittivity) only under this fixed-Z0
  comparison. It is not a measured flex geometry. At fixed conductor geometry,
  changing dielectric generally changes Z0 as well.
- Keep the exported cable values as the reference pending measurement. Flex
  effective permittivity, impedance, conductor resistance, and termination are
  not established by the material name alone. Each reference line totals
  935 pF distributed capacitance, not a single lumped capacitor at R30.
- The simplified finite-gain op amps have ideal zero output impedance. Actual
  output drive impedance, stability, receiver termination, and cable losses
  still need validation. Agreement among these scenarios does not bound those
  omitted effects.
- Intrinsic amplifier noise, detector leakage, and resistor thermal/excess
  noise are not included in this external bias-path budget.

Reproduce on the Pi with `python3 software/bias_filter/audit_lmfe_cable_noise.py`
and summarize with `node software/bias_filter/summarize_lmfe_cable_audit.cjs`.
The audit resumes saved cases; use a new output filename after changing a model
or settings so old results are not mixed with a new experiment.

`refresh_lmfe_reference.py` refreshes all reference SPICE results and charge
calibration using the saved FEA capacitance matrix; no new FEA is needed.
