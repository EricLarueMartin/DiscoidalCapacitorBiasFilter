# Frequency-domain electric-field results

`default-eqs-sweep.json` is the first input-to-output field-derived frequency
sweep for the built-in default geometry. It was run with FEniCSx 0.9.0 on the
deployed Raspberry Pi using a 0.30 mm full-stack mesh (29,696 cells). Each of
the three bias plates is excited in turn to extract the full complex admittance
matrix. The transfer calculation then fixes the input at 1 V, leaves any
interior bias ports floating, and terminates the output with the selected DC
load, detector capacitance, and lumped cable capacitance.

Three plates are intentional in the built-in reference: the stack contains two
mirror-equivalent end plates and one true interior plate. The electrostatic
Maxwell extraction gives `42.7451, 42.7723, 42.7451 pF` to ground and
`0.129553 pF` between either adjacent pair. The solved peak field is
`6.01063 kV/mm` at 6 kV bias.

The model is axisymmetric electroquasistatic (EQS). It includes distributed
electric field, displacement current, epoxy DC conductivity, and a continuous
resistive-core cylinder calibrated to 12 MOhm per stage. It does not include
magnetic induction, resonant magnetic energy, skin/proximity effects,
radiation, transmission-line propagation, or the physical 3D MELF helix.

The `validation/` files repeat 1 kHz on 0.60 and 0.45 mm meshes. Together with
the 0.30 mm sweep they give -49.758580, -49.756402, and -49.755046 dB,
respectively. The result changes only 0.00354 dB over that refinement range.
The high-frequency `Im(Y)/omega` matrix agrees with the independent
electrostatic FEniCSx Maxwell matrix to 0.20% for the diagonal term and 0.61%
for mutual coupling. The computed matrix is reciprocal to machine precision,
and the minimum eigenvalue of `Re(Y)` remains positive in the saved sweep.

`intrinsic-spice-eqs-comparison.json` removes the source resistor, output
resistor, cable, detector capacitance, and load conductance from both models.
It fixes the first bias plate at 1 V and measures the final plate open-circuit.
Under those matched port conditions, FEniCSx and the independent lumped
`G + j omega C` model give -22.7567 and -22.6457 dB at 1 kHz. Their largest
difference is 1.794 dB near the deep 100 kHz transition; the difference is
0.014 dB at 50 Hz and 0.077 dB at the high-frequency asymptote. This is the
appropriate filter-only comparison. The loaded sweep is
retained separately because it answers a different system-level question.

Reproduce the sweep on the FEniCSx host with:

```bash
python3 software/bias_filter/admittance_fenicsx_solver.py \
  --parameters hardware/geometry/default-parameters.json \
  --frequencies 1 10 50 100 1000 10000 100000 1000000 10000000 100000000 300000000 1000000000 \
  --mesh-mm 0.3 \
  --output simulations/electromagnetic/default-eqs-sweep.json
```

## Full-wave overlap and first mode

`latest-full-wave.json` uses `2 px/mm` for every displayed MEEP point. EQS and
MEEP share 300 MHz and 1 GHz nodes. A single constant offset aligns the
uncalibrated MEEP terminal-voltage ratio at 300 MHz; the independent 1 GHz
node differs by only `+0.283 dB`, satisfying the displayed 1 dB handoff
criterion. This two-point check replaces an earlier mixed-resolution result
whose apparent `+6.27 dB` slope disagreement was numerical.

The full-wave curve then departs sharply above 1 GHz. Resonance refinement
finds the first verified local transmission maximum at `11.4815 GHz`, bracketed
by solved points at `10.0000` and `13.1826 GHz`; the saved sweep also includes
post-mode points at `15.1356` and `30 GHz`. Calling the mode verified means
that it is a converged local maximum with solved points on both sides, not just
the largest value at the end of a requested sweep.

The frequency-domain ladder's `350 mOhm` trace is deliberately a low-loss
reference used to expose natural modes. For a series RLC modal approximation,
`f_peak = f0 sqrt(1 - 2 zeta^2)`, where
`zeta = R/2 sqrt(C/L)`. The physical 12 MOhm core is strongly overdamped in
that approximation, so it has no shifted amplitude peak to compare with the
low-loss reference. The MEEP feature may therefore represent distributed
field/cavity coupling rather than a lightly shifted version of either ladder
mode; calibrated ports, mesh refinement, and ultimately a 3D check remain
necessary before treating its amplitude as quantitative.

After downloading a matching electrostatic job and SPICE response, rebuild all
GitHub Pages result bundles with:

```bash
python3 software/bias_filter/build_default_bundles.py \
  --field-job /path/to/field-job.json \
  --spice /path/to/spice-result.json
```
