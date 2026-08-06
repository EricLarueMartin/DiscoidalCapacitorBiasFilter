# Full-Wave Maxwell Handoff - 2026-08-03

## Implemented

- `full_wave_meep_solver.py` provides the first magnetic/radiative field solve.
- MEEP 1.29 is installed on the development Pi through `python3-meep`.
- `/api/full-wave-solve` runs the sweep with resource monitoring and writes
  `simulations/electromagnetic/latest-full-wave.json`.
- The Electrical solver settings include a full-wave resolution control,
  solve button, running/error state, and memory/swap readouts.
- **Full-Wave Maxwell Transfer and Emission** is in Models & FEA Results.
- `default-full-wave.js` supplies the convergence-audited default result to the
  static deck.

## Electrical Interpretation

The axisymmetric source and voltage probes cross the input and output
core-to-ground apertures. Core sections are homogeneous surrogates with
`sigma=L/(RA)`. Input, stage, and output resistance are assigned independently;
the default uses 12 Mohm, 12 Mohm, and 50 ohm. The 50 ohm core section is not a
matched coax port, and the SPICE cable/detector/load are absent from this
intrinsic field solve.

Undefined regions are free space. Explicit epoxy, alumina, core, plate, and
tube regions override it. Radial and axial PML layers absorb outgoing fields.
The result is cylindrical `m=0`; asymmetric leads, the MELF helix, and
non-axisymmetric modes still require 3D work.

## Saved Result And Verification

The original 3-cells/mm sweep at 0.1, 0.3, 1, 3, 10, and 30 GHz passed a `1e-4` CW
residual at every point. Terminal transfer is approximately -99.19, -98.91,
-95.17, -54.91, -11.88, and -57.80 dB. The 10 GHz feature is not yet mesh or
frequency converged.

The initial emission monitors used unshifted z coordinates and returned exact
zero output flux. Correcting them to the centered MEEP cell fixed the output.
Signed flux remains in JSON; slide fractions use positive outward power only.

The final run took 967 s, peaked at 132.1 MiB process-tree RSS, had 7.11 GiB
minimum available memory, and used no swap.

## Next Checks

1. Run 2/3/4-cells-per-mm comparisons at representative points.
2. Replace the resonance-oriented baseline with the ADC-band overlap sweep at
   31.25, 62.5, 100, 300, and 1000 MHz. EQS continues down to 1 Hz.
3. Add calibrated impedance ports if S-parameters are required.
4. Build the 3D asymmetric geometry and compare with prototype measurements.

## ADC-Band Refocus

The default sweep was subsequently changed to 31.25, 62.5, 100, 300, and
1000 MHz for the 62.5 MS/s detector ADC. All five 3-cells/mm points converged
below `1e-4`; terminal attenuation was -99.21, -99.11, -99.19, -98.91, and
-95.17 dB. The run took 1393 s. The 31.25 MHz Nyquist point and 62.5 MHz
sample-rate point overlap the 1 Hz to 100 MHz EQS result.

Electrical smallness is not treated as proof that shielding is unimportant.
Near-field, common-mode, lead, and aperture coupling remain possible. The
axisymmetric flux monitors are relative boundary-flow checks, however: the
3 mm PML is not a calibrated far-field boundary at metre-scale wavelengths,
and asymmetric external conductors require a later 3D model.
