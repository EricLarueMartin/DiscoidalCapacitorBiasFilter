# CAEN A1560 output sketch update — 2026-09-22

The user supplied `CAEN A1560 HV board circuit sketch.pdf` (one page). It shows multiplier → a few tens of kΩ → 1 nF shunt → unspecified HV filter with another 1 nF connection → a few tens of kΩ → output, with 1 nF and a 300 MΩ divider from output to ground.

The modeled boundary is the output of the unspecified internal HV filter. User-selected final series R is 40 kΩ; this is an approximation to the sketch label, not an exact manufacturer resistance. The output has 1 nF parallel with 300 MΩ to ground, followed by the existing input cable. Do not add the other two 1 nF capacitors at this boundary or invent the internal filter impedance. The discoidal output resistor remains 47 Ω.

Default parameters: `bias_source_resistance_mohm=0.04`, `bias_source_capacitance_nf=1`, `bias_source_divider_mohm=300` (zero divider disables it for comparisons). The small-signal shunt is `Y=1/Rdivider+jωC`; before cable transformation, `Vth=Vin/(1+RsY)` and `Zth=Rs/(1+RsY)`. The same network is present in ngspice, including the upstream return path when a series pickup source is inserted with zero cable length.

## 50 Hz result

`simulations/spice/caen-dp270-50hz.json` compares the old 1 MΩ/no-shunt assumption, 40 kΩ alone with divider, and 40 kΩ/1 nF with divider, all using the same newly solved DP270 FEA capacitance network. Output is the LMFE differential R30 voltage.

| Excitation | Old 1 MΩ | 40 kΩ + 1 nF | Change |
|---|---:|---:|---:|
| Internal supply voltage, V/V | 0.563643 | 0.610094 | +0.688 dB |
| Input cable series EMF, V/V | 0.591380 | 0.610371 | +0.275 dB |
| Cryostat series EMF, V/V | 6.147400 | 6.147341 | −0.000083 dB |
| Current into filter-input node, V/A | 563643 | 24404 | −27.271 dB |

The lower impedance strongly helps current-coupled input pickup. It does not attenuate an ideal imposed series EMF. Cryostat pickup bypasses the input filter. The isolated 40 kΩ/1 nF corner is 3978.9 Hz; its ideal 50 Hz attenuation is only 0.000686 dB. In the complete loaded circuit, adding 1 nF to 40 kΩ changes the supply path by −0.00210 dB. Do not describe this as a 50 Hz notch.

The manufacturer's ripple specifications apply at the output terminal; the presentation's existing upstream-source excitation is a conservative comparison convention, not a reconstructed internal spectrum. Unknown upstream impedance, regulation loop, distributed/common-mode coupling, grounding and measurement bandwidth need measurement before making absolute noise claims.

## Historical note — superseded output impedance assumption

The following earlier analysis used a provisional 1 MΩ model and is retained as history, not current default data.

# CAEN supply reference for LEGEND

## Identification

CAEN's 4 January 2021 announcement identifies **A1560HDPE** positive-HV
boards in SY4527/SY5527 mainframes for LEGEND-200. It names N1471H as the
earlier GERDA supply. This is stronger evidence for the experiment reference
than the user's tentative recollection of N1470, but does not establish which
unit is present on a particular laboratory bench.

Source: https://www.caen.it/news/caen-germanium-solutions-for-legend-200-experiment/

## Published ripple and modeling defaults

The A1560H technical table specifies:

| Band | Typical ripple | Maximum ripple | Reference setting |
| --- | --- | --- | --- |
| 20 Hz--1 kHz | <5 mV p-p | <10 mV p-p | 10 mV p-p |
| 1 kHz--20 MHz | <3 mV p-p | <5 mV p-p | 5 mV p-p |

Source: https://caen.it/products/a1560h/

The browser's supply amplitude controls the low band, with high-band amplitude
set to half that value. This preserves the ratio of the published maxima;
it does not represent the typical-ripple ratio. These are band specifications,
not a measured spectrum or a separate 50 Hz line measurement.

For an explicit stress scenario, convert each band amplitude to sine RMS,
`Vpp/(2 sqrt(2))`, and locate its largest shaped energy response within that
band. Add the two band powers. Separately show the low-band amplitude placed
entirely at the selected mains frequency; do not add it again to the low-band
worst-frequency term. Frequencies below 20 Hz and above 20 MHz remain
uncharacterized by this source. A peak-to-peak value alone cannot determine
RMS of an arbitrary noise waveform.

## Output impedance remains an assumption

Keep **1 Mohm** as instructed by the user while awaiting CAEN's response.
The public specification used here does not establish the complex output
impedance. A constant resistor is a provisional Thevenin representation;
regulation bandwidth and internal filtering may make actual Zout frequency
dependent. Neither the maximum output voltage divided by current limit nor
DC regulation accuracy determines small-signal output impedance.

Use 0.1, 1 and 10 Mohm as an engineering sensitivity sweep, not a claimed
manufacturer uncertainty interval. Include a low-impedance case to see how
much the result relies on the input-cable RC attenuation. Do not assume
1 Mohm is universally conservative: it changes both supply attenuation and
the external pickup termination.

The 10 m, 50 ohm, vf=0.66 input cable contributes about 1.011 nF when
electrically short. With 1 Mohm alone, `1/(2 pi R C)` is about 157 Hz;
the filter input resistance and downstream network modify the actual pole.
The SPICE transmission line already contains this capacitance.

The ripple specification is treated as an equivalent open-circuit source
amplitude before the assumed output resistor. Manufacturer test loading,
internal sense-point placement, common-mode coupling and the frequency
dependence of output impedance need confirmation before claiming precise
installed-system attenuation. Common floating return does not by itself
eliminate cable-ground pickup.

## Reference calculation

With the saved three-plate FEA network, 1 Mohm source R, 10 pF detector,
and 10 us/4 us trapezoid, the low-band all-at-50-Hz scenario gives
109.74 eV RMS; the two-band maximum-ripple scenario gives 231.03 eV RMS.
These are calculated scenarios, not measured supply-induced resolution.
The existing cable placeholders dominate the independent total, approximately
1983.32 eV RMS. Changing supply amplitudes or shaping only recalculates the
browser noise budget, using the existing SPICE transfer and charge transient.

Verified using `node software/bias_filter/test_noise_budget.cjs`.
