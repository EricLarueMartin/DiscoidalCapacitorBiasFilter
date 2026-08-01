# Frequency-domain electric-field results

`default-eqs-sweep.json` is the first input-to-output field-derived frequency
sweep for the built-in default geometry. It was run with FEniCSx 0.9.0 on the
deployed Raspberry Pi using a 0.30 mm full-stack mesh (20,562 cells). Each of
the two bias plates is excited in turn to extract the full complex admittance
matrix. The transfer calculation then fixes the input at 1 V, leaves any
interior bias ports floating, and terminates the output with the selected DC
load, detector capacitance, and lumped cable capacitance.

The model is axisymmetric electroquasistatic (EQS). It includes distributed
electric field, displacement current, epoxy DC conductivity, and a continuous
resistive-core cylinder calibrated to 12 MOhm per stage. It does not include
magnetic induction, resonant magnetic energy, skin/proximity effects,
radiation, transmission-line propagation, or the physical 3D MELF helix.

The `validation/` files repeat 1 kHz on 0.60 and 0.45 mm meshes. Together with
the 0.30 mm sweep they give -38.062692, -38.062610, and -38.062554 dB,
respectively. The result changes only 0.00014 dB over that refinement range.
The high-frequency `Im(Y)/omega` matrix agrees with the independent
electrostatic FEniCSx Maxwell matrix to 0.11% for the diagonal term and 0.83%
for mutual coupling. The computed matrix is reciprocal to machine precision,
and the minimum eigenvalue of `Re(Y)` remains positive in the saved sweep.

`intrinsic-spice-eqs-comparison.json` removes the source resistor, output
resistor, cable, detector capacitance, and load conductance from both models.
It fixes the first bias plate at 1 V and measures the final plate open-circuit.
Under those matched port conditions, FEniCSx and SPICE give -10.08 and
-10.03 dB at 1 kHz; their maximum difference across the saved points is
0.62 dB. This is the appropriate filter-only comparison. The loaded sweep is
retained separately because it answers a different system-level question.

Reproduce the sweep on the FEniCSx host with:

```bash
python3 software/bias_filter/admittance_fenicsx_solver.py \
  --parameters hardware/geometry/default-parameters.json \
  --frequencies 1 10 100 1000 10000 100000 1000000 10000000 100000000 \
  --mesh-mm 0.3 \
  --output simulations/electromagnetic/default-eqs-sweep.json
```
