# Rotational Axisymmetry Sensitivity

## Question Being Tested

The current electrical and thermal FEniCSx models are two-dimensional `r-z`
models revolved through 360 degrees. This is **rotational axisymmetry** about the
filter axis. It is distinct from axial mirror symmetry and the repeated-cell
approximation along `z`; those reductions already have separate validation.

The new study asks how much the rotationally axisymmetric approximation changes
capacitance, distributed admittance, noise transfer, and local field stress
when real three-dimensional features are introduced.

## Comparison Strategy

Begin with a 3D solid of revolution that is geometrically identical to the
validated 2D model. This is a code-verification case: the 3D and `2 pi r` 2D
integrals should agree after independent mesh-convergence studies. Do not begin
with a complicated MELF or connector geometry, because a disagreement would
then mix formulation, meshing, and physical asymmetry.

After the exact-revolve baseline passes, add one controlled asymmetry at a time.
Use a full 360-degree mesh for a single defect or eccentric feature. A periodic
sector is acceptable only when the modeled feature actually repeats with that
period; it cannot represent one hole, one void, one lead, or an offset core.

## First Perturbation Ladder

Run these in order, starting with a one-bias-plate or one-stage geometry sized
to fit comfortably in memory:

1. **Exact 3D revolve:** no physical asymmetry; validates the 3D formulation.
2. **Core eccentricity:** offset the core by 0.10, 0.25, and 0.50 mm while
   preserving all other dimensions.
3. **Single plate fill hole:** add one realistic epoxy-flow or vent hole at
   increasing distance from the high-field rounded edge.
4. **Single epoxy void:** place a small spherical or rounded void near the
   inner ground edge and outer bias edge separately.
5. **Finite ground connection:** replace the perfectly continuous external
   ground assumption with one realistic tab or strap geometry.
6. **MELF body and terminals:** model the resistor ceramic, end caps, leads or
   solder joints, and intended routing without pretending it is rotationally
   symmetric.
7. **Input/output packaging:** add screw-terminal or later SHV-adjacent metal
   only after the internal stack cases are understood.

Tilt, washer misregistration, chipped edges, and multiple random voids are later
manufacturing-tolerance studies. They should not be mixed into the first
symmetry comparison.

## Quantities To Compare

For every 3D case compare against the converged axisymmetric reference:

- Total and node-resolved capacitance.
- Full complex admittance matrix at selected frequencies.
- Loaded `Vout / Vin` and attenuation at 50 Hz, 60 Hz, the RC corner region,
  1 MHz, and 100 MHz.
- Integrated resistive and dielectric loss by material.
- Neighborhood-supported peak electric field, material, location, and edge
  class.
- Raw point peak as a diagnostic only.
- Peak process RSS, total system memory, swap, cell count, and solve time.

Report both signed and absolute changes. A small capacitance change does not
prove that axisymmetry is adequate if a local three-dimensional feature raises
the supported field materially.

## Initial Acceptance Bands

These are triage bands, not physical qualification limits:

- Exact 3D revolve versus 2D: less than 1% difference in integrated
  capacitance/admittance after both are mesh converged.
- Reciprocity residual: less than 0.5% for materially nonzero matrix entries.
- Screening-level symmetry adequacy: less than 2% change in transfer magnitude
  and less than 5% change in supported peak field for the tested perturbation.
- Any change of peak material or physical edge class is automatically notable,
  even if the magnitude remains inside a percentage band.

Tighten these bands after the first converged 3D revolve establishes realistic
numerical error. Do not loosen them simply because a coarse 3D mesh is
expensive.

## Resource-Bounded Workflow

The Pi backend must continue to serialize FEA jobs. A 3D solve can grow much
faster than the current axisymmetric direct solve, so use this sequence:

1. Mesh and solve one small baseline in an isolated subprocess.
2. Record memory after mesh generation and after each basis solve.
3. Stop before swap growth or out-of-memory risk becomes material.
4. Increase azimuthal and local edge resolution separately to identify which
   controls the result.
5. Reuse a mesh across electrode basis excitations at one frequency.
6. Run a sparse frequency set before a full sweep.
7. Store compact JSON summaries in Git; keep large meshes and field files as
   generated artifacts.

If a full 360-degree default stack is too large for the Pi, reduce plate count
and domain extent for formulation validation first. Do not replace a unique
asymmetry with a periodic wedge merely to make the result fit.

## First Deliverable

The first meaningful deliverable is not a production 3D filter result. It is a
paired, mesh-converged record containing:

1. one-bias exact-revolve 2D electrostatic/EQS result;
2. the geometrically identical full 3D result;
3. one eccentric-core 3D perturbation;
4. capacitance, selected admittance entries, supported field, and resource
   comparisons;
5. a decision on whether the next perturbation should be a plate hole, a void,
   or the MELF geometry.

This establishes how much rotational symmetry matters before committing Pi
resources to a full nonaxisymmetric stack.
