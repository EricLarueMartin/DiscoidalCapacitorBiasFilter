# Reconciling CV/e with 50 Hz Equivalent Noise Charge

Exact 50 Hz SPICE audit, 2026-09-10. Reference circuit, nominal 1 Mohm regulator,
10 m source/HV cables, three bias plates, 10 Mohm input and stage resistors,
47 ohm output, and the exported 10 m output-pair cable model. Pole-zero is OFF;
trapezoid rise/flat are 10/4 us. This is not the newly offered flex preset.

The user's 5 mV * 2 pF / e = 62,415 electrons is correct. For the model's
10 mV peak-to-peak sinusoidal ripple, 5 mV is PEAK, so the RMS starting point
is 44,134 electrons at 2 pF. The earlier reported 36.3 electrons RMS instead
used the 10 pF reference detector (220,671 electrons RMS before any filtering).
Comparing 62,415 with 36.3 produces 64.7 dB but mixes capacitance and peak/RMS.

| Contribution (positive means rejection) | 2 pF | 10 pF |
| --- | ---: | ---: |
| Regulator/internal source to filter input | 0.717 dB | 0.717 dB |
| Filter input to voltage across detector | 20.314 dB | 20.377 dB |
| Preamplifier sinusoid response, referred to raw charge-pulse peak | 19.176 dB | 19.038 dB |
| Trapezoid applied to noise | 47.134 dB | 47.134 dB |
| Correction for reduced shaped charge-pulse amplitude | -13.992 dB | -11.596 dB |
| Total, consistent RMS CV/e to shaped ENC | 73.350 dB | 75.671 dB |
| Final ENC | 9.490 electrons RMS | 36.324 electrons RMS |

The 2 pF case was actually rerun with a new charge transient; it is not obtained
by dividing the 10 pF result by five. The actual amplifier and shaped signal
calibration depend on detector capacitance.

For 2 pF: 3.5355 mV RMS at the source becomes 0.3140 mV across the detector,
0.38964 mV differential at R30, and 1.71372 uV after shaping. The shaped
1 fC calibration is 1.127086 mV/fC. Thus the charge noise is 0.0015205 fC,
or 9.49 electrons RMS. At 10 pF the corresponding R30/shaped values are
1.93410 mV / 8.50659 uV and the calibration is 1.461692 mV/fC.

The physical filter's substantial 50 Hz rejection comes largely from the
approximately 1 nF HV output-cable capacitance loaded through approximately
30 Mohm total filter series resistance, not just the approximately 45 pF stage
capacitances. A crude 30 Mohm * 1 nF single-pole estimate has a 5.3 Hz corner;
the table uses the actual circuit, not this estimate.

The preamplifier's roughly 19 dB follows the finite 1 Gohm / 0.35 pF feedback
decay time (350 us): a 50 Hz sine is not equivalent to an instantaneous charge
step. The simple charge-sensitive-amplifier factor omega*tau/sqrt(1+(omega*tau)^2)
is about 0.109 at 50 Hz. The table uses the complete simulated amplifier and
known-charge response, so this is an explanatory approximation only.

For the two-window digital shaper, low-frequency magnitude is approximately
2*pi*f*(rise+flat) = 0.004398 at 50 Hz. The raw 47.13 dB is NOT all available
as ENC improvement: the same shaping reduces the signal calibration from
5.64350 to 1.12709 mV/fC at 2 pF, or from 5.55437 to 1.46169 at 10 pF.
Net shaping improvements are therefore 33.14 and 35.54 dB respectively.
This explicitly accounts for shaping both signal and noise.

The supply's full ripple allowance concentrated in a 50 Hz sine is an assumed
scenario, not its measured spectrum. Do not add it again to the two-band supply
envelope estimate. Pole-zero correction or actual firmware baseline processing
changes the result; see `digital-energy-shaping.md`.

Reproduce with `audit_supply_50hz.py` on the Pi followed by
`summarize_supply_50hz.cjs`. Raw voltages, parameters and charge transients are
in `simulations/spice/supply-50hz-breakdown.json`; arithmetic results are in the
adjacent `supply-50hz-breakdown-summary.json`.
