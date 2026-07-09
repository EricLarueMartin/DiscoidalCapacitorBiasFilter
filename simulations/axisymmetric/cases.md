# Axisymmetric Simulation Cases

## Analytic Benchmark Cases

Run these before relying on the full filter model:

1. Parallel plates: verify `E = V / gap`.
2. Coaxial cylinders: verify `E(a) = V / (a ln(b / a))`.
3. Cylinder over ground plane: verify the `acosh` local-edge transition used by the web heuristic.
4. Cylinder inside equal-clearance grounded shell: verify the surrounding-ground limit.
5. Sphere inside equal-clearance grounded shell: verify the deliberately pessimistic 3D envelope.
6. Equal circular conducting disks at fixed potential: compare capacitance and edge charge behavior against Love-equation references.
7. Rounded 2D conducting wedge or plate edge: verify mesh convergence around a finite edge radius.

## Case A: Inner Ground-Plate Edge

Geometry:

- One ground-connected annular plate.
- High-voltage plate on each axial side.
- Rounded inner edge on the ground plate.
- Conductive core treated as an HV equipotential.
- Dielectric regions split into flat washer slabs between plate faces and epoxy/fill around the core, rounded-edge pockets, and fringe regions.

Outputs:

- Peak electric field near inner ground-plate edge.
- Sensitivity to `edge_radius`, `plate_gap`, washer permittivity, and epoxy/fill permittivity.
- Mesh convergence of the rounded-edge peak field using local refinement around the fillet.

## Case B: Outer HV-Plate Edge Without Tube

Geometry:

- One high-voltage center plate.
- Ground plate on each axial side.
- Rounded outer edge on the HV plate.
- No surrounding ground tube.
- Epoxy fills the rounded HV outer-edge pocket; the washer remains a flat slab in the adjacent axial gap.

Outputs:

- Peak electric field near outer HV-plate edge.
- Fringe-field shape outside plate overlap.
- Mesh convergence of the rounded-edge peak field using local refinement around the fillet.

## Case C: Outer HV-Plate Edge With Tube

Geometry:

- Same as Case B.
- Add surrounding grounded tube at `tube_id`.
- Epoxy fills the tube-side radial gap and rounded-edge pockets.

Outputs:

- Peak electric field near HV plate edge.
- Field concentration at tube-facing surfaces.
- Capacitance change relative to Case B.
- Mesh convergence of edge and tube-facing peak fields.

## Case D: Dielectric Boundary Sweep

Geometry:

- Based on Case A or B.
- Move the boundary between high-permittivity and low-permittivity dielectric inward and outward from the plate-overlap edge, while keeping the physical washer as a flat slab unless deliberately testing a nonphysical approximation.

Outputs:

- Peak field.
- Capacitance.
- Field-line behavior around the boundary.
- Sensitivity to local refinement where the dielectric boundary terminates near the plate edge.

## Case E: Mirror Symmetry Code Validation

Purpose:

- Confirm that the `mirror_half` reduced-domain solve matches a full-stack reference before that code path is used for design decisions.
- This is a code validation check. The mirror symmetry itself is exact for the idealized uniform stack.

Procedure:

1. Run a full-stack solve on the current default geometry.
2. Run a mirror-half solve on the same geometry once that solver path is implemented.
3. Reconstruct the full field from the mirrored result and compare peak field, peak location, and interior field samples.

Initial acceptance gates:

- Peak field agrees within roughly 0.5% or 10 V/mm, whichever is looser during solver development.
- Peak location maps to the same physical edge class.
- Reconstructed full-field samples agree within roughly 1%.
