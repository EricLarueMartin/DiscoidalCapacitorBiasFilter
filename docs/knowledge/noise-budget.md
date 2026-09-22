# Detector-noise stopping criterion

The [50 Hz attenuation breakdown](supply-50hz-breakdown.md) reconciles the
instantaneous CV/e estimate with physical-circuit filtering, preamplifier
response, trapezoidal shaping, and signal calibration for 2 pF and 10 pF.

See [digital energy shaping](digital-energy-shaping.md) for the joint shaping
bypass and optional pole-zero correction, applied equally to signal and noise.

The [2026-09-10 output-cable audit](lmfe-output-cable-noise-audit.md) corrects
the previously omitted 10 m O2/O4 amplifier output lines and recalibrates the
charge response. It reports the explicit 50 Hz contribution, supply impedance
sensitivity, and remaining limitations; use those results instead of earlier
no-output-cable noise numbers.

## Purpose

The filter should not be made longer merely because another simulated stage
produces a larger attenuation number. This note defines a deliberately strict
stopping criterion: voltage noise coupled through the detector-bias path should
contribute no more than one tenth of the irreducible Fano fluctuation at the
Ge-76 neutrinoless-double-beta endpoint.

The current reference uses three complete SPICE responses through the reduced
LMFE, followed by the discrete trapezoidal estimator and known-charge transient
calibration. Supply noise, outside-cryostat pickup, and inside-cryostat pickup
are included separately. All passive impedances remain in every solve.
Older ladder-only and trap-only descriptions below document the previous
approximation, now used only as an explicitly labeled fallback when complete
SPICE results are missing. These inputs remain provisional allocations.

## Complete three-source model (2026-09-05)

CAEN identifies **A1560HDPE** boards for LEGEND-200. See
[the CAEN supply note](caen-hv-supply.md) for sources and assumptions.
The reference now uses maximum ripple of 10 mV p-p at 20--1000 Hz and
5 mV p-p at 1 kHz--20 MHz. Output resistance remains **1 Mohm**, explicitly
unverified pending CAEN's response. The ORTEC attribution and bandwidth
have been retired.

| Source | Excitation | Circuit retained |
| --- | --- | --- |
| CAEN supply | AC voltage at internal source | 1 Mohm output R, input line, full FEA C network and resistors, output line, detector/LMFE |
| External pickup | Series induced EMF between input cable and filter | Regulator and both cables, full filter and detector/LMFE |
| Cryostat pickup | Series induced EMF between output cable and detector cathode | Both cables, full filter termination and detector/LMFE |

Cable-end EMFs approximate distributed pickup; they are not ideal voltage
clamps to ground or measured node voltages. Their locations remain an
assumption. The separate historical current-injection sensitivity studies
use `I=V/Z0`, which is a different source convention and cannot be interpreted
as the same voltage-noise budget.

For each source, `G_j(f)` is differential R30 volts per source volt. The common
transient gives `K_E`, equivalent eV per shaped R30 volt. Then:

```text
sigma_j,broadband^2 = K_E^2 integral S_j(f) |G_j(f) H_trap(f)|^2 df
sigma_j,line = K_E V_j,rms |G_j(f_line) H_trap(f_line)|
sigma_total^2 = sum_j sigma_j^2             (independent sources)
FWHM = 2.35482 sqrt(sigma_Fano^2 + sigma_total^2)
```

The supply input uses a sine scenario `Vrms=Vpp/(2 sqrt(2))`. One scenario
places the low-band ripple at the selected mains frequency; another finds
the largest response within each published band and sums those band powers.
The mains-only low-band alternative is not added twice. This is not a
rigorous RMS bound for an arbitrary waveform.
Mains pickup may be correlated: a separate sum of line magnitudes reports
the possible same-phase result. Independent powers are the plotted baseline.

At low frequency, input-line capacitance is `L/(Z0 vf c) = 1010.80 pF` for
10 m, 50 ohm, and vf=0.66. It is the shunt element between regulator R and
filter input R in the T network. `Tsource` already includes it; do not add it
again as a lumped capacitor.

### Verification and reference results

`software/bias_filter/refresh_noise_reference.py` solves 401 points per source,
reuses the reference FEA capacitance network, and refreshes the static bundle.
It writes generated decks and results to
`simulations/spice/three-noise-sources-validation.json`.

- T-network complex transfer agrees with the line solve at 50, 60 and 70 Hz
  within 1.5e-9 relative error.
- Simultaneous-source output agrees with the sum of separate complex SPICE
  outputs within 1.3e-8 relative error at those frequencies.
- `node software/bias_filter/test_noise_budget.cjs` verifies zero input,
  linear amplitude scaling, source isolation, quadrature sum, explicit mains
  inclusion and recalculation when shaping changes.
- An initial attempt used `I=V/50 ohm` for voltage-valued cable pickup, giving
  about 4.09 MeV RMS in the high-impedance low-frequency circuit. That result
  is rejected as a prediction for these voltage inputs. The main budget now
  uses localized series EMFs; the current-source studies retain their own
  explicit convention. This was a source-model correction, not curve fitting.

For the current three-plate reference, 10 us/4 us shaping, 10 pF detector,
unverified 10 mV p-p supply, and each cable source at 0.20 mV RMS mains plus
0.05 mV RMS broadband:

| Contribution | Equivalent RMS energy |
| --- | ---: |
| Supply entirely at 50 Hz (alternative) | 109.74 eV |
| Supply worst-frequency scenario (used in total) | 230.25 eV |
| Outside-cryostat pickup | 6.51 eV |
| Inside-cryostat pickup | 1969.81 eV |
| Independent total | 1983.23 eV |
| Calculated Fano | 831.46 eV |

The combined modeled FWHM is 5.064 keV under these placeholders. This is not
a measured detector resolution or a CAEN-specified performance prediction.
Confirm CAEN model/specification and measure cryostat coupling before using
it to choose final geometry.

## Fano calculation

LEGEND gives the Ge-76 endpoint as `Q_beta_beta = 2039 keV` [1]. Use mean
electron-hole-pair energy `w = 2.96 eV` for cryogenic germanium. The Fano
factor remains a visible browser input because no located measurement directly
determines it at both `Q_beta_beta` and the approximately 87 K liquid-argon
operating temperature.

The default is an inverse-variance weighted mean of three retained cryogenic
gamma-energy measurements that report both a central value and a usable
numerical uncertainty:

| Measurement | Energy coverage | F |
|---|---:|---:|
| Bilger (1967) [2] | 122 keV to 4.8 MeV | `0.129 +/- 0.003` |
| Croft and Bond (1991) [4] | 14 keV to 6.129 MeV | `0.112 +/- 0.001` |
| Priharti et al. (2015) [5] | 46 keV to 1.333 MeV | `0.123 +/- 0.003` |

With weights `u_i = 1 / sigma_i^2`,

```
F_default = sum(u_i F_i) / sum(u_i) = 0.1145455.
```

Lalovic et al. reported `0.058 +/- 0.011` [3], substantially below the other
three measurements, and is deliberately excluded from the default estimate.
This remains an estimate for Ge-76 operation near liquid-argon temperature,
not a direct measurement under those conditions. Even the three retained
values have more scatter than their quoted statistical errors (`chi^2 / dof`
is about `19`), so the formal weighted-mean error of about `0.0009` is not a
credible total uncertainty. The browser slider spans the historical
high-energy range for sensitivity studies. Values without published
uncertainty, bounds, and low-energy measurements are documented by the cited
reviews but are not assigned invented weights.

The number of pairs and its Fano fluctuation are

```
N = E / w
sigma_N = sqrt(F N)
sigma_E = w sigma_N = sqrt(F w E).
```

At `E = 2.039e6 eV` and the default `F = 0.1145455`, this gives

```
sigma_E,Fano = 831.5 eV rms
FWHM_Fano = 2.35482 sigma = 1.958 keV
10% allocation = 83.1 eV rms = 28.1 electron-hole pairs.
```

For an entered detector capacitance `C_detector`, the conservative voltage
allocation is

```
V_target = (0.1 sigma_E / w) e / C_detector.
```

For `C_detector = 10 pF`, `V_target = 0.450 microvolt rms`.

The full endpoint signal is about `688,851` electron-hole pairs or `110.4 fC`.
The one-tenth-Fano allocation adds only `1%` to the Fano variance: the
Fano-only resolution changes from `1.958 keV` to approximately `1.968 keV`
FWHM. This is intentionally a strict subsystem allocation. The allocation is
fixed at one tenth in the current interface; only the uncertain Fano factor is
adjustable.

## Public readout anchors

A published LEGEND full-chain test records FlashCam waveforms at a `62.5 MHz`
sampling frequency with `8192` samples, corresponding to `131.072 microseconds`
[8]. This is a
documented operating value, not evidence that 8192 samples is the firmware
maximum.

The public LegendDSP reference energy `e_10410` uses a normalized symmetric
trapezoid with `10 microseconds` rise/fall averaging and a `4 microseconds`
flat top [9]. LegendDSP also supports optimized per-channel rise and flat-top
settings, so `10/4 microseconds` is a reviewable default rather than a claim
about current production settings.

Observed LEGEND resolution is a total detector-and-readout result. It is not an
input to this subsystem allocation and is not combined with predicted bias
noise. The filter is judged directly against the calculated irreducible Fano
RMS fluctuation.

## Trapezoidal response

For rise length `M` samples and flat-top length `G` samples, the normalized
symmetric trapezoid is the difference between two `M`-sample moving averages:

```
H_trap(z) = (1/M) (1 - z^-M)/(1 - z^-1) (1 - z^-(M+G)).
```

Its magnitude at digital angular frequency `omega = 2 pi f / fs` is

```
|H_trap| = |sin(M omega/2)/(M sin(omega/2))|
           * 2 |sin((M+G) omega/2)|.
```

At frequencies far below the shaping scale,
`|H_trap| approximately 2 pi f (T_rise + T_flat)`. The `10/4 microsecond`
reference therefore attenuates a 50 Hz sinusoid by about `47.1 dB` in voltage.
This low-frequency rejection was missing from the earlier web estimate.

For ideal pole-zero correction of a charge-sensitive preamplifier, bias
voltage noise maps to equivalent collected charge through

```
S_E(f) = (w C_detector / e)^2 S_V,input(f)
         |H_ladder(f)|^2 |H_trap(f)|^2.
```

Discrete spectral lines use the same transfer without integrating a PSD. Noise
components are combined as variances, and the resulting bias-noise RMS energy
is combined in quadrature with the Fano RMS width.

## Provisional source envelope

CAEN's A1560H specification, adopted after the 2026-09-05 identification,
gives maximum ripple of 10 mV p-p at 20--1000 Hz and 5 mV p-p at
1 kHz--20 MHz; see [source details](caen-hv-supply.md). Keep output resistance
at `1 Mohm` pending CAEN's response. A peak-to-peak limit does not specify
either RMS noise or its spectrum. Cable pickup is even less universal: it
depends on shield construction, grounding, tray neighbors, loop area, and
terminations. The browser therefore keeps five visibly editable noise inputs:

The complete-filter SPICE slide also includes a distinct regulator-to-bare-
filter trace. Its reference source uses the Designer `HV regulator output R`
setting, default `1 Mohm`, followed by a provisional 10 m input coax and the
configured filter input resistance. Unlike the 50 ohm test-port trace, it
reports transfer from the regulator's internal noise source and therefore
includes source-to-first-stage injection loss. This is currently an idealized
source model rather than a measured regulator output network. The noise-budget
integration retains its loaded regulator-to-detector ladder path so supply
noise is evaluated with the actual output cable and detector load rather than
the slide's deliberately unloaded comparison boundary.

- supply limit: `10 mV p-p`, converted to `3.54 mV rms` as a sine-equivalent
  value and conservatively placed at the frequency having the largest combined
  ladder-plus-trapezoid response between 5 Hz and the smaller of 50 MHz and
  Nyquist;
- broadband pickup induced along 10 m of RG-58 before the filter: `0.05 mV rms`,
  provisionally distributed as white voltage-noise power from 1 Hz to Nyquist;
- coherent pickup induced along the RG-58 input cable: `0.20 mV rms` at `50 Hz`,
  with 60 Hz selectable for North American measurements;
- broadband pickup on the custom cryostat cable after the filter: `0.05 mV rms`;
- coherent pickup on the custom cryostat cable after the filter: `0.20 mV rms`
  at the selected power-line frequency;
- ADC sampling frequency: `62.5 MHz`, hence ordinary Nyquist bandwidth `31.25 MHz`.

The upstream supply and RG-58 contributions use `H_ladder H_trap`. Treating
distributed RG-58 pickup as though it all enters at the filter input is
conservative for pickup induced near the filter; a future distributed-source
cable model can refine this. The upstream broadband contribution is

```
e_out,input = e_in,input / sqrt(B)
              * sqrt(integral |H_ladder(f) H_trap(f)|^2 df).
```

The downstream custom-cable broadband contribution is

```
e_out,cable = e_in,cable / sqrt(B)
              * sqrt(integral |H_trap(f)|^2 df).
```

Each line term is evaluated at its exact frequency. The `0.20 mV rms` defaults
are deliberately rounded placeholders, not published typical-noise
specifications. Representative Belden 9201 RG-58 data specify approximately
`52 ohm`, velocity factor `0.66`, capacitance `93.5 pF/m`, and outer-shield DC
resistance `23 ohm/km`, or `0.23 ohm` over 10 m [10]. This supports the model's
50 ohm and 0.66 propagation defaults but does not determine induced pickup.
A recent laboratory survey also found strongly
room-dependent 50 Hz fields, about `0.059-0.144 microtesla` magnetic and
`0.4-12.9 V/m` electric in the reported locations [11]. These observations
support treating cable-tray pickup as an installation-dependent allocation.

The `0.05 mV rms` broadband defaults are likewise provisional. The two
cryostat-cable values are especially weak assumptions because the cable
construction and internal pickup environment are not yet characterized. The
RG-58 inputs should be replaced by spectra measured at the filter input; the
cryostat inputs should be replaced by detector-end spectra with the intended
grounding and tray loading.
Cable common mode, grounds, the preamplifier, microphonics, detector
leakage-current noise, resistor Johnson noise, and aliasing from above Nyquist
still need separate allocations.

## Reduced LMFE pickup model

The maintained ngspice reduction is in
`simulations/spice/legend_lmfe_pickup.lib`, with a directly runnable example in
`simulations/spice/legend_lmfe_pickup_standalone.cir`. It is derived from the
working local source schematic `LEGEND-200_LMFE_CC4_Simplified.asc`; that LTspice
schematic remains the reference when the detector electronics change.

The reduction retains the MX11RC input JFET, BF862 cascode, 1 m signal-line
delays, `0.35 pF || 1 Gohm` feedback, and the two outputs across R30. It removes
the op-amp bias filters and the later AD8139 differential-output section. The
two retained LMH6654 functions are represented by single-pole ideal op amps
with `AOL = 100,000` and `GBW = 10 MHz`. This is intended to preserve detector
input impedance and pickup-to-front-end frequency response, not output-driver
loading or detailed amplifier noise.

The backend connects a lossless transmission line using the Designer output
cable length, characteristic impedance, and velocity factor to the complete
selected filter output rather than a fixed resistor. The reduced LMFE library
begins at the detector cathode, so the generated top-level deck is the single
source of cable geometry. A `1 A` AC current source at the detector cathode
then gives:

```text
Zpickup(f) = V(outp,outn) / Ipickup
Zdet(f)    = V(cathode) / Ipickup
```

`C19` is always taken from the Designer/Electrical Detector C setting. The
default `10 pF` is deliberately at the high end for a detector and therefore a
conservative input-capacitance case. The complete-filter slide plots
`-20 log10(|Zpickup| / max |Zpickup|)` so the pickup-response shape can share
the existing nonnegative attenuation axis. Absolute transimpedance in ohms is
retained in the backend JSON and generated netlist.

The first Pi integration check with the current three-plate default produced a
peak pickup transimpedance of approximately `2.38 kohm`, detector-node
impedance of approximately `36.8 Mohm` at `1 Hz`, and approximately `37 ohm` at
`100 MHz`. These are model outputs, not measured front-end specifications.

### Output-stage sensitivity and detector-step calibration

The simplified amplifier also has a separate `1 V AC` solve at the MX11RC J2
gate. It provides an input-referred review quantity for each frequency:

```text
G_gate(f)   = V_R30,gate(f) / V_gate(f)
V_n,gate(f) = Z_pickup(f) I_pickup(f) / |G_gate(f)|
```

This ratio answers how large a sinusoidal disturbance at the J2 gate would
produce the same R30 output as the modeled cathode pickup. If the same linear
trapezoidal transfer `H_trap(f)` is applied to both numerator and denominator
at one frequency, it cancels. The trapezoid is therefore intentionally omitted
from this AC input-referred diagnostic.

That cancellation does not make the AC gate ratio an event-energy calibration.
A germanium event deposits charge and produces a preamplifier step, so energy
resolution uses the shaped pickup spectrum and the shaped response to a known
charge transient described below. The resulting independent pickup and Fano
terms are combined in quadrature:

```text
sigma_total = sqrt(sigma_Fano^2 + sigma_pickup^2)
```

The pickup run injects `1 A AC` at the C19 cathode and measures differential
R30 output. This is a transimpedance calculation:

```text
Z_pickup(f) = V_R30,pickup(f) / I_cathode(f)
I_cathode(f) = V_pickup(f) / Z0
```

The Designer's cryostat broadband and line-pickup amplitudes drive this
transfer. The frequency-dependent trapezoidal response is applied, broadband
power is integrated from 1 Hz to the `31.25 MHz` Nyquist limit, and the
broadband and line variances are combined. The browser plots this shaped
pickup as RMS differential voltage at R30.

The earlier calculation divided this pickup response by the `1 V AC` J2-gate
gain independently at every frequency and then converted that spectrum to
energy. That is not the correct normalization for the detector signal. A Ge
detector event is approximately a voltage step with less than `100 ns` 10%-90%
rise, while the trapezoidal estimator returns one scalar pulse amplitude. The
correct calibration is therefore:

```text
1. Inject a known detector charge as current from the cathode to the J2 gate.
2. Pass the simulated R30 waveform through the selected trapezoidal estimator.
3. Record the shaped R30 amplitude per coulomb of collected charge.
4. Divide shaped R30 pickup RMS by that calibration to obtain equivalent charge.
5. Convert charge to electron-hole pairs and use `2.96 eV/pair` for equivalent energy.
```

The backend now performs this transient with a `1 fC`, `100 ns` charge pulse
from cathode to gate and retains the sampled differential R30 waveform. The
charge integrates on the `0.35 pF` feedback capacitor; its ideal local step is
`Q/Cf = 2.86 mV` before the rest of the differential response. Adaptive
ngspice points are resampled onto the declared `62.5 MHz` ADC grid before the
browser applies the selected trapezoid. Changing rise or flat-top settings
therefore recalculates the charge calibration without another FEA or SPICE run.
The old `0.338 eV rms` numbers and apparent `51 ohm` optimum remain withdrawn;
new equivalent-energy values use the shaped transient amplitude rather than a
frequency-by-frequency AC-gain denominator.

The filter topology also matters. The physical model places the final-node
`Cg` from the last bias plate to ground and puts `Rout` between that node and
the 10 m HV cable. An LTspice source written as `V16 Rser=Rout Cpar=Cg` instead
places both properties inside a Thevenin source model. At `100 kHz`, where a
`40 pF` capacitor has about `39.8 kohm` reactance, the latter topology makes
pickup scale almost directly with `Rout`; the ratio `51/22` alone predicts
about `7.3 dB`, close to the observed `6.8 dB` difference. That is evidence of
the topology mismatch, not proof that `22 ohm` is the optimum physical filter
termination.

The corrected default simulation gives about `1.4 mV` shaped differential R30
amplitude for `1 fC` with the `10 us / 4 us` trapezoid. Around the design's
`44.8 pF` output capacitance, the calculated energy-noise result is nearly
unchanged between the stocked `22 ohm` and `51 ohm` resistors. Output resistance
should therefore be selected mainly for transient reflections and pulse-shape
fidelity, not from a `100 kHz` energy-resolution proxy.

The original LTspice cable model has `L = 228 nH/m` and `C = 99.1 pF/m`, giving
`Z0 = sqrt(L/C) = 47.97 ohm` and approximately `47.5 ns` one-way delay for 10 m.
The generated reference deck uses the editable `50 ohm`, velocity-factor
`0.66`, `10 m` Designer approximation, or `50.5 ns` one-way delay.
Because the detector rise time is comparable to the cable round trip, output
resistance should be selected using transient reflection and pulse-shape
fidelity, followed by in-situ testing. The reference default is therefore the
stocked `47 ohm` value, pending that transient study. Also, the current
`10 us` trapezoid has its first moving-average null near `100 kHz`, so a single
100 kHz AC point is a poor proxy for integrated energy noise.

The earlier LTspice singular-matrix failure in the simplified schematic was
caused by accidentally deleting `+VB1`, the positive reference/supply node for
U2. Restoring that source gave LTspice a valid DC operating path. This was a
schematic connectivity problem rather than evidence that the reduction itself
was numerically ill-conditioned.

During the transient-calibration addition, the ngspice reduction was also
found to have reversed the two input labels of the LTspice `opamp.sub` helper.
LTspice uses pin order `inverting, non-inverting, output`; correcting that order
removed an unphysical positive-feedback operating point and made the transient
settle near `2.94 V`. Absolute results generated with the earlier reversed
polarity are invalid and have been regenerated.

## Information needed to replace the envelope

The next defensible revision needs the following experiment-specific inputs:

1. The actual HV-supply model and an output-noise PSD or spectrum under the
   intended voltage, current, and cable load.
2. Measured spectra at the filter input and detector-bias node with supply on,
   supply off, and representative laboratory equipment operating. Preserve
   coherent 50 Hz harmonics rather than smoothing them into broadband PSD.
3. Current per-channel trapezoid rise time, flat top, pole-zero constant,
   baseline window, pickoff definition, sample rate, and waveform length from
   the production DSP configuration.
4. Detector capacitance or, preferably, a pulser calibration that directly
   measures bias-terminal voltage to reconstructed-energy transfer.
5. Spectra with intentional cable motion and grounding changes to identify
   microphonic or common-mode pickup that bypasses the bias filter.

## Length decision

For the present 2.0 mm plates, 1.0 mm epoxy gaps, and equal plate thicknesses,
the stack length is approximately `6 n + 2 mm` for `n` bias plates. Five plates
are 32 mm; a 100 mm stack would contain about 16 bias plates before allowance
for end hardware. Custom gap and plate dimensions change this directly.

The design should stop adding stages when all of the following are true:

1. The loaded SPICE-plus-trapezoid integration is below the selected Fano
   allocation with documented source spectra and DSP settings.
2. The exact five-plate Maxwell capacitance extraction agrees with the reduced
   network closely enough for the design decision.
3. EQS and full-wave sweeps show no relevant departure from the RC model through
   31.25 MHz, with margin for anti-alias behavior.
4. Added stages no longer change the detector allocation materially, or other
   noise paths dominate.

The one-tenth-Fano target is already much stricter than requiring filter noise
to be merely subdominant. It is therefore a sensible point beyond which a
larger simulated attenuation number is not by itself a reason to lengthen the
filter.

## Five-plate weekend verification

Use a five-bias-plate geometry for the first rigorous run while retaining the
two-plate design for rapid iteration.

1. Run the exact node-resolved electrostatic solve with repeated-cell mode off.
2. Save the Maxwell matrix and rerun at a finer edge-radius mesh ratio.
3. Use EQS points at 50 Hz, 60 Hz, 1 kHz, 10 kHz, 100 kHz, 1 MHz, 10 MHz,
   31.25 MHz, 62.5 MHz, 100 MHz, 300 MHz, and 1 GHz.
4. Begin MEEP with a coarse logarithmic set such as 1, 2, 3, 5, 7.5, 10, 15,
   20, and 30 GHz. Add points around the first candidate mode after inspection.
5. Repeat at 1.5, 2.0, and 2.5 cells/mm. Treat resonance frequency and amplitude
   as quantitative only after convergence with resolution.
6. Compare intrinsic-port EQS, SPICE, and MEEP over their overlap. The present
   radial MEEP source is overlap-normalized rather than an impedance-calibrated
   wave port, so it can bracket structural departure and resonances but cannot
   yet prove absolute full-wave transfer amplitude.
7. Record elapsed time, peak process-tree RSS, lowest free memory, and swap use.

The completed five-plate, 31.5 mm, 2-cells/mm reference sweep at 1, 3, 10, and
30 GHz took 523 seconds on the 8 GB project Pi, peaked at about 429 MiB process
RSS, and used no swap. The browser estimate scales this reference by model
length, approximately the square of spatial resolution, and selected frequency
points. It reports a broad range because convergence near a mode can be several
times slower than neighboring points.

A 100 mm structure may move an axial wavelength-scale mode downward by roughly
the inverse length ratio; scaling the exploratory 10 GHz candidate from 31.5 mm
suggests an order-of-magnitude location near 3 GHz, still far above the ADC
band. This is only a planning estimate. Leads, penetrations, and non-axisymmetric
modes require 3D validation.

## Sources

1. [LEGEND: Ge-76 decay endpoint and detector concept](https://legend-exp.org/science/legend-pathway/paving-the-way)
2. [Bilger: Fano Factor in Germanium at 77 K](https://doi.org/10.1103/PhysRev.163.238)
3. [Lalovic et al.: Measurements of the Fano factor in germanium](https://doi.org/10.1016/0029-554X(71)90352-1)
4. [Croft and Bond: A determination of the Fano factor for germanium at 77.4 K](https://doi.org/10.1016/0883-2889(91)90002-I)
5. [Priharti et al.: Determination of Fano factor and pre-amplifier noise](https://www.ukm.my/jsm/pdf_files/SM-PDF-44-5-2015/17%20W.%20Priharti%20.pdf)
6. [Cryogenic germanium pair energy and Fano-factor discussion](https://pure.mpg.de/rest/items/item_3684046_1/component/file_3684047/content)
7. Retired ORTEC 660 reference: not the installed CAEN supply; do not use it as a CAEN specification.
8. [LEGEND full-chain test: 62.5 MHz and 8192-sample waveforms](https://www.osti.gov/pages/servlets/purl/3001827)
9. [LegendDSP API: e_10410 and optimized trapezoidal estimators](https://legend-exp.github.io/LegendDSP.jl/stable/api/)
10. [Belden 9201 RG-58 data: nominal 52 ohm, 93.5 pF/m, 66% velocity, and shield resistance](https://catalog.belden.com/techdata/en/9201_techdata.pdf)
11. [Measured 50 Hz electric and magnetic fields in laboratory rooms](https://pmc.ncbi.nlm.nih.gov/articles/PMC13035650/)


## Slide 5 display convention (2026-09-22)

Slide 5 expresses every noise amplitude as standard deviation (sigma), with energy noise in eV. Its Fano card uses the calculated fanoSigmaEv directly, rather than the Gaussian FWHM. The zero-mean electrical-noise amplitudes already computed as RMS have the same numerical standard deviation. Supply ripple limits are displayed as 3.54 mV sigma and 1.77 mV sigma under the existing sinusoidal conversion, Vpp / (2 sqrt(2)); this is a waveform assumption, not a universal peak-to-peak conversion. Physics and noise integration are unchanged.
