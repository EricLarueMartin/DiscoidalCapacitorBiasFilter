# Axisymmetric Full-Wave Maxwell Model

## Purpose And Scope

`software/bias_filter/full_wave_meep_solver.py` is the first field model in
this repository that includes magnetic induction and electromagnetic power
leaving the filter. It uses MEEP 1.29 in cylindrical coordinates with the
rotationally symmetric `m = 0` mode. It complements rather than replaces
SPICE for the loaded detector system, FEniCSx electroquasistatics for the
distributed-RC limit, and electrostatic FEniCSx for capacitance and peak field.

The generated stack sits inside a larger free-space domain. Explicit epoxy,
alumina, resistive-core, plate, and tube regions override free space. Perfectly
matched layers terminate the radial and axial exterior boundaries. Copper is
ideal metal because the present grid does not resolve micrometre-scale skin
depth. The RF geometry uses sharp cylindrical plate edges; rounded FEniCSx
geometry remains authoritative for local electrostatic stress.

## Browser sweep controls and long jobs

The Electrical solver tab exposes separate comma-separated EQS and MEEP
frequency lists. Entries accept Hz, kHz, MHz, and GHz suffixes, allowing a
coarse resonance search followed by a locally refined sweep. Full-wave solves
use the same queued-job lifecycle as field solves. The browser stores the job
ID and can reconnect after a refresh; closing the tab does not cancel the Pi
subprocess.

The per-job timeout is adjustable from five minutes through seven days. The
backend writes job input, result, error, and resource-use information under the
simulation directory. This makes multi-hour or weekend convergence studies
possible without keeping one HTTP request open.

The browser time estimate is calibrated to the completed five-plate, 31.5 mm,
2-cells/mm project-Pi run: 523 seconds, about 429 MiB peak process RSS, and no
swap for 1, 3, 10, and 30 GHz. The estimate scales by stack length, spatial
resolution, and selected frequencies and is displayed as a broad range because
the point near the candidate 10 GHz mode converged much more slowly than its
neighbors.

## Ports And Resistance Calibration

Input and output voltage probes integrate radial electric field across the
core-to-ground aperture at the first and final ground plates. The source is a
distributed radial lumped excitation across the input aperture. This reports
terminal voltage transfer, not impedance-normalized `S21`.

Every core section has an independently calibrated conductivity:

```text
sigma_i = L_i / (R_i Acore)
Acore = pi (core_OD / 2)^2
```

The first section uses input series resistance, sections between bias plates
use stage resistance, and the final section uses output series resistance.

| Default section | Length | Resistance | Conductivity |
|---|---:|---:|---:|
| Input | 3.0 mm | 12 Mohm | 6.5767e-5 S/m |
| Interstage | 4.5 mm | 12 Mohm | 9.8650e-5 S/m |
| Output | 3.0 mm | 50 ohm | 15.784 S/m |

The 50 ohm value is the output resistive-core section, not coax impedance, and
does not make the probe a matched 50-ohm wave port. The SPICE cable, detector,
and load are not included in this intrinsic field solve.

For direct entered resistor capacitance, the core uses the fitted package-only
permittivity described in `rc-network.md`. Surrounding epoxy remains a separate
material and displacement-current path.

## Outputs

Each frequency records complex terminal voltages, `Vout/Vin`, signed radial
and axial Poynting flux, positive-outward flux fractions, CW residual and
iterations, solve time, and monitored resources. Raw signed flux remains in
the JSON. Presentation percentages normalize only positive outward power
because the source-side surface can have net inward power from the imposed
source and reflected field.

## Frequency Range

The displayed full-field sweep starts at 50 Hz. FEniCSx EQS supplies the
low-frequency limit through shared 300 MHz and 1 GHz overlap points; asking the wavelength-oriented
MEEP/PML model to solve 50 Hz directly would be both ill-conditioned and a
poor radiation-boundary model for a free-space wavelength of thousands of
kilometres. MEEP checks 300 MHz, 1 GHz, 3 GHz, 10 GHz, and 30 GHz before any
local refinement. The point after a candidate peak remains on the plot so its
bracket is visible. The full-field backend job regenerates both branches for the current design:
it first solves EQS from 50 Hz through 1 GHz, then
runs the MEEP resonance search. It therefore does not combine a newly solved
high-frequency curve with stale low-frequency results from another geometry.

The presentation plots voltage-noise spectral-power attenuation:

```text
A_noise = -10 log10(Sout / Sin) = -20 log10|Vout / Vin|
```

The equality assumes the same voltage-noise reference at input and output; it
is not an impedance-normalized `S21` power measurement. Because the current
radial MEEP excitation is not a calibrated wave port, its transfer curve is
shifted by one constant so that it equals EQS at 300 MHz. The separately
solved 1 GHz point is not forced to agree: its residual reports whether EQS
and MEEP have the same slope through the overlap. A large residual invalidates
the handoff rather than being hidden by a two-parameter fit. Absolute
full-wave transfer still requires calibrated ports.

The screening acceptance is `2 dB` at the independent overlap point. This is
the same order as the separate EQS-to-lumped-model comparison and reflects the
low-frequency accuracy available from the coarse MEEP grid and uncalibrated
radial source. The 1.0 mm gap / 2.0 mm plate reference gave a `1.44 dB`
residual at 2 cells/mm. A 3 cells/mm rerun became markedly worse rather than
converging, confirming that the low-frequency MEEP port treatment, not the
field residual, limits a tighter handoff claim. Do not interpret the 2 dB gate
as quantitative full-wave validation; calibrated ports remain required.

The filter is much smaller than a wavelength throughout most of this range,
which makes a strong geometrical cavity resonance unlikely. It does not make
electromagnetic coupling zero. Fringing electric fields, common-mode currents,
lead coupling, and fields through apertures can all make the grounded tube
important. The MEEP solve is retained to test those mechanisms and the
transition away from the electroquasistatic approximation.

The current outer margin and 3 mm PML do not form a calibrated far-field
radiation domain at the lower MEEP points. The reported flux is power crossing
the model's monitoring surfaces and is useful for relative boundary-flow
checks. It must not be read
as an absolute radiated-power or antenna-efficiency result. A practical EMI
model also needs the asymmetric leads, connector transitions, and cable
common-mode path that the `m = 0` geometry omits.

## Saved Reference Result

The original two-bias reference used 3 cells/mm and a `1e-4` CW residual target:

| Frequency | Vout/Vin | Iterations | Final residual |
|---:|---:|---:|---:|
| 100 MHz | -99.19 dB | 3294 | 9.65e-5 |
| 300 MHz | -98.91 dB | 1984 | 8.45e-5 |
| 1 GHz | -95.17 dB | 1851 | 9.95e-5 |
| 3 GHz | -54.91 dB | 1339 | 7.02e-5 |
| 10 GHz | -11.88 dB | 644 | 9.27e-5 |
| 30 GHz | -57.80 dB | 2859 | 9.40e-5 |

All points passed the requested residual. Raw MEEP transfer remains close to
-99 dB through 300 MHz, rises to -95.17 dB at 1 GHz, and reaches a local
maximum of -11.88 dB at 10 GHz before falling again at 30 GHz. The 10 GHz
point is therefore the first bracketed candidate mode, but its frequency and
amplitude still require mesh and frequency refinement.

The six-point reference took about 951 s in total on the 8 GB Raspberry Pi 5.
The current four-point sweep retains 1, 3, 10, and 30 GHz. The 100 and 300 MHz
MEEP points were removed because EQS already covers that electrically small
region and the near-static CW systems dominate runtime.

A five-bias, 3-cells/mm run twice reached the backend's former 2700 s timeout.
Peak process-tree RSS was only about 428 MiB, lowest available system memory
remained above 6.7 GiB, and swap use stayed at zero. This established that the
failure was CW convergence time rather than memory pressure. The four-point
sweep and 1 GHz overlap address that bottleneck. The timeout is now a browser
setting from five minutes through seven days rather than a fixed one-hour
guard.

The interactive default is therefore 2 cells/mm. A 3-cells/mm run remains a
required convergence comparison before using a resonance quantitatively, but
it is not a practical first-pass setting for the five-bias stack: a diagnostic
1 GHz solve was still running after 974 s when stopped, with 412 MiB peak RSS,
6.78 GiB minimum available memory, and zero swap use.

The complete five-bias sweep at the 2-cells/mm screening default finished in
523 s. The 1, 3, 10, and 30 GHz points took 43.5, 34.8, 295.2, and 91.2 s;
all met the `1e-4` residual target. Peak process-tree RSS was 429 MiB, minimum
available memory was 7.34 GB, and swap use was zero. The 10 GHz point required
5622 iterations and dominates the revised runtime because it lies near the
candidate mode.

## Validation History And Remaining Work

The first emission extraction left axial monitors in unshifted stack
coordinates after centering the MEEP cell. The upper monitor was outside the
cell and returned exactly zero; signed percentages also exceeded 100%.
Centered-cell monitor and saved-field coordinates fixed this. A coarse rerun
produced nonzero output flux, and the final sweep uses corrected coordinates.
This failure is retained because the impossible output exposed the error.

Remaining validation:

1. Repeat transfer and flux at multiple spatial resolutions.
2. Replace constant lower-point normalization with calibrated common port definitions; retain at least two shared points to test slope.
3. Add calibrated impedance ports when direct S-parameters are needed.
4. Compare with a 3D model containing leads and realistic openings.
5. Compare with prototype impedance or S-parameter measurements.

The axisymmetric solve cannot excite non-axisymmetric cavity modes, antenna
currents on leads, or the MELF helix. It is the exact symmetry reference for
the ideal rotational geometry, not final validation of physical hardware.
## Resonance Verification

The browser offers an optional coarse-to-fine resonance verification pass. The requested MEEP frequency list is first solved at half the selected spatial resolution, with a lower limit of 1 cell/mm. Candidate frequencies come from local maxima in that coarse sweep and from the low-loss coupled-stage model. For the transfer function used here, a matched RLC mode has a driven-response amplitude peak only when \(\zeta < 1/\sqrt{2}\). Its additional candidate frequency is

\[
f_{\mathrm{peak}} = f_0\sqrt{1-2\zeta^2}.
\]

For larger damping the RLC model contributes no shifted amplitude-peak candidate, although the zero-loss mode and coarse field sweep can still seed refinement. Each distinct candidate is then surrounded by seven logarithmically spaced solves spanning \(\pm 0.18\) decade at the selected full-wave resolution. The software calls a resonance verified only when the largest fine-grid response has solved points on both sides and both neighboring responses are lower. A model prediction by itself is not reported as a verified resonance.

The full-field presentation overlays these ladder predictions on the same
log-frequency axis as EQS and MEEP. Dotted markers identify the low-loss
ladder natural frequencies. Separate loaded-peak markers use the equation
above with the selected stage resistance. When no real loaded peak exists,
the result panel says `none; overdamped` rather than placing a misleading
frequency marker. These are model predictions to compare with MEEP, not
substitutes for a bracketed field-solver maximum.

The coupled-ladder plot deliberately uses `350 mOhm` per stage to expose its
otherwise hidden LC natural modes. That curve is not the physical filter. For
the saved `12 Mohm` validation stages (the current circuit default is 10 Mohm), the matched-mode damping ratio is far above
`1/sqrt(2)`, so the equation above has no real amplitude-peak frequency: the
mode is overdamped rather than shifted. A MEEP peak that survives with the
physical core conductivity therefore needs to be treated as a different field
coupling path or a port/model artifact until overlap, mesh, and 3D checks pass.

The result JSON preserves `coarse_samples`, `refined_samples`, candidate provenance, refinement brackets, and verified peaks. The browser reports both the estimated runtime and the measured backend duration. Mesh convergence still requires repeating the verification at a higher selected resolution; a bracketed peak on one mesh is evidence of a mode, not a completed convergence study.
