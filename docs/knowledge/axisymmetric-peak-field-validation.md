# Axis and peak-field validation (2026-09-22)

The electrostatic model rotates the r-z cross-section about r=0, the core centreline along the horizontal z axis at the bottom of the drawing. In FEniCSx x[0]=r and x[1]=z. The weak form uses epsilon*r*grad(u).grad(v); the common 2*pi cancels. Stored energy uses pi*epsilon0*epsilon_r*r*|grad(V)|^2, including both the cylindrical volume factor and 1/2 energy factor. Axial half-stack symmetry and end/repeat reconstruction are separate reductions of this cylindrical model.

The default 2.2 mm core and 4 mm ground ID give a minimum radial gap of (4-2.2)/2 = 0.90 mm. The field model holds the core at 6 kV and ground plates at zero; it is an axisymmetric equipotential-core proxy, not a resolved MELF resistor helix.

## Cause and correction

The previous 7.62 kV/mm displayed peak at the bias OD was misleading. Plate vertices had a fine mesh but the straight core boundary inherited the coarse rectangle mesh. The browser grid also began about 0.1135 mm outside the core. A refinement-only sweep exposed a second issue: eight straight segments per rounded quarter-circle create artificial facet corners.

Peak-field solves now use 64 segments per quarter-circle, core-boundary target size min(plate fine size, radial gap/32), and six additional near-core radial samples. Capacitance basis and EQS geometry retain their existing discretization. The extracted Maxwell network is exactly unchanged and the saved SPICE result still matches it.

## Checks at 6 kV

| Case | Core/ground peak (kV/mm) | Bias OD peak (kV/mm) |
| --- | ---: | ---: |
| Smooth end cell, uniform 0.04 mm mesh | 8.211 | 7.595 |
| Smooth end cell, uniform 0.02 mm mesh | 8.289 | 7.642 |
| Corrected production end cell | 8.317 | 7.597 |
| Corrected production interior cell | 8.039 | 7.585 |
| Corrected mirror half stack, 90,616 cells | 8.326 | 7.588 |
| Corrected full seven-plate stack, 183,046 cells | 8.336 | 7.594 |

The full and mirror raw peaks differ by 0.12%. The saved end/repeat default reports a neighborhood-supported peak of 8.315 kV/mm at r=1.10625 mm, z=0.8 mm, with raw sampled peak 8.317 kV/mm. Full-stack values above are independent field-only checks, not relabeled default full-field outputs. The fine uniform end-cell mesh differs from the production end result by 0.33%; changing uniform mesh from 0.04 to 0.02 mm changes its peak by 0.95%. These are numerical checks, not material-breakdown qualification.

An independent cylindrical annulus check uses the actual potential solver and E(r)=V/[r*ln(b/a)]. With a=1.1 mm, b=2 mm, its maximum sampled relative field error is 0.383%. The analytic coax surface field is 9.124 kV/mm; finite rounded ground rings have a different boundary geometry, so this is a solver check rather than an expected identical plate-gap value. [Analytical reference](https://doc.comsol.com/6.3/doc/com.comsol.help.models.acdc.electric_field_concentric_cylinders/electric_field_concentric_cylinders.html).

## Reproduction and records

Run on the Pi FEniCSx environment:

```sh
python3 software/bias_filter/validate_axisymmetric_peak.py --production --output simulations/axisymmetric/outputs/default-dp270-axisymmetry-corrected-validation.json
python3 software/bias_filter/validate_axisymmetric_peak.py --smooth --output simulations/axisymmetric/outputs/default-dp270-axisymmetry-smooth-validation.json
```

The original coarse-profile sweep is saved as `default-dp270-axisymmetry-peak-validation.json`. The previous default is preserved as `default-dp270-seven-plate-field-before-core-refinement.json`. Corrected default job `ff9a637398904e28aa5d56113871ff40` is saved as `default-dp270-seven-plate-field.json` and bundled into `presentations/web/default-fenicsx-field-dp270.js` with the existing exactly matching SPICE result.

Slide 4 removes ferrite references, corrects the 0.90 mm radial gap, and uses the current DP270/40 C thermal assumptions. Field drawings explicitly label the rotation axis. Simulation runs remain manual and plate-count capacitance reuse remains supported. Existing RF convergence/handoff diagnostic flags are unchanged.

Validation: 84 Python tests; manual simulation/slide gating, capacitance reuse, and default noise-budget JavaScript tests; live visual inspection of reference and peak-field slides.
