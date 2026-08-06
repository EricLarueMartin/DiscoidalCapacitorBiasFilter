# Detector-noise stopping criterion

## Purpose

The filter should not be made longer merely because another simulated stage
produces a larger attenuation number. This note defines a deliberately strict
stopping criterion: voltage noise coupled through the detector-bias path should
contribute no more than one tenth of the irreducible Fano fluctuation at the
Ge-76 neutrinoless-double-beta endpoint.

This is a preliminary allocation, not a complete detector electronics model.
The browser now propagates input-referred bias voltage noise through both the
loaded RC ladder and the discrete trapezoidal energy estimator. It retains the
conservative full-coupling relation `Q_noise = C_detector V_noise` after ideal
charge-preamplifier pole-zero correction. Detector weighting-field coupling,
imperfect pole-zero correction, downstream pickup, and channel-specific DSP
still require measurement.

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

The ORTEC 660 detector-bias supply specifies less than `10 mV peak-to-peak`
noise and ripple from 5 Hz to 50 MHz [7]. A peak-to-peak limit does not specify
either RMS noise or its spectrum. The browser therefore keeps three visibly
editable stress-test inputs:

- supply limit: `10 mV p-p`, converted to `3.54 mV rms` as a sine-equivalent
  value and conservatively placed at the frequency having the largest combined
  ladder-plus-trapezoid response between 5 Hz and the smaller of 50 MHz and
  Nyquist;
- broadband laboratory pickup: `10 mV rms`, provisionally treated as white
  input-referred voltage noise from 1 Hz to Nyquist;
- coherent power-line pickup: `10 mV rms` at `50 Hz`, appropriate to Gran
  Sasso, with 60 Hz selectable for North American measurements;
- ADC sampling frequency: `62.5 MHz`, hence ordinary Nyquist bandwidth `31.25 MHz`.

The broadband output is calculated as

```
e_out = e_in / sqrt(B)
        * sqrt(integral |H_ladder(f) H_trap(f)|^2 df).
```

The line term is evaluated at its exact frequency. For orientation, the current
two-plate default has about `18.2 dB` loaded-ladder attenuation at 50 Hz. With
the `47.1 dB` trapezoid rejection, a `10 mV rms` input line corresponds to about
`1.0 keV rms` at `10 pF`, while the `3.54 mV rms` sine-equivalent supply limit
would correspond to about `0.35 keV rms` if concentrated at 50 Hz. The
one-tenth-Fano target requires the 50 Hz input-referred line to be roughly below
`0.9 mV rms` for that geometry. These values scale linearly with detector
capacitance and line amplitude and must not substitute for a measured spectrum.

Pickup coupled downstream of the filter is not attenuated by this model. Cable
common mode, grounds, the preamplifier, microphonics, detector leakage-current
noise, resistor Johnson noise, and aliasing from frequencies above Nyquist need
separate allocations.

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

For the present 1.5 mm plates, 1.5 mm washers, and equal plate thicknesses, the
stack length is approximately `6 n + 1.5 mm` for `n` bias plates. Five plates
are 31.5 mm; a 100 mm stack would contain about 16 bias plates before allowance
for end hardware. Custom washer and plate dimensions change this directly.

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
7. [ORTEC 660 detector-bias supply: less than 10 mV p-p, 5 Hz to 50 MHz](https://www.ortec-online.com/products/electronic-instruments/nim-power-supplies-and-bins/660)
8. [LEGEND full-chain test: 62.5 MHz and 8192-sample waveforms](https://www.osti.gov/pages/servlets/purl/3001827)
9. [LegendDSP API: e_10410 and optimized trapezoidal estimators](https://legend-exp.github.io/LegendDSP.jl/stable/api/)
