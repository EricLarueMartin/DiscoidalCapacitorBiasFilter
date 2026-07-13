# Simulation Plan

## Primary Model Class

Use axisymmetric electrostatic simulations where possible. The geometry is intended to be cylindrical, so 2D r-z simulations should capture the dominant field behavior before moving to full 3D.

## Initial Simulation Targets

1. Inner rounded edge of a ground plate with high-voltage plates on both sides.
2. Outer rounded edge of a high-voltage plate with surrounding ground plates.
3. Outer-edge case with and without a surrounding ground tube.
4. Dielectric boundary placement near the end of plate overlap.

## Parameters

- Core outside diameter.
- Tube inside diameter.
- Ground plate outside diameter.
- HV plate outside diameter.
- Gap between plates.
- Plate thickness.
- Edge radius.
- Relative permittivity between plates.
- Relative permittivity outside the overlap.
- Relative permittivity near the central core.

## Outputs

- Peak electric field.
- Peak electric field by dielectric region. The conductive core is an equipotential body for this screening solve, so the core-to-ground dielectric gap is counted under epoxy/fill rather than as a core dielectric.
- Dielectric-strength margin by region, `E_breakdown / E_max`, using selected material placeholders until measured values are available.
- Field enhancement near rounded edges.
- Capacitance per plate gap.
- Sensitivity to dielectric boundary placement.
- Flat washer material only in the axial gaps between adjacent plate faces; epoxy fills rounded-edge pockets and other non-washer voids.
- Sensitivity to the presence or absence of the ground tube.

## Approximate Edge Screening

Before full FEA, use the local cylinder edge heuristic in `edge-effects.md` to compare plate gap and edge-diameter-percent choices in the web interface. The heuristic evaluates the axial plate gap, the ground-plate inner edge to HV core gap, and the HV-plate outer edge to ground-tube gap as separate cases. The two radial cases also include the coaxial-cylinder baseline, so equal radial gaps still show the smaller-radius core side as more restrictive. Treat this as a prioritization tool only; any geometry near the target dielectric stress limit still needs an axisymmetric solve.

## Web-To-FEA Backend

Keep browser-side approximations and quick screening available without a backend. When a Pi-hosted or workstation-hosted field solver is added, expose it as a per-job API rather than a shared `latest-*` file workflow; see `pi-fea-backend.md`.

The JavaScript fallback and the current Python backend use locally refined structured relaxation grids for better edge visualization, but they remain screening tools. Rounded-edge grid spacing should be no larger than about one tenth of the physical edge radius when the radius is nonzero. Both paths may run a short probe solve, refine around high-field dielectric nodes, and then run a final seeded solve on the refined grid.

The Python backend now returns nonuniform `rCoords` and `zCoords` plus mesh metadata. The browser field plot draws cells from those coordinates rather than from a fixed pixel raster. This is adaptive coordinate refinement on a structured finite-difference stencil, not a conforming finite-element mesh.

The capacitance model intentionally keeps using the simple washer-overlap approximation. The field solvers use a z-dependent dielectric map: washer permittivity only inside flat annular washer slabs between plate faces, and epoxy permittivity around the rounded plate edges. This matters for edge-stress estimates because the rounded-edge high-field region is usually in epoxy, not in the washer.

As of the current handoff, the flat washer-overlap regions must verify against the expected `E = V / gap` baseline before any rounded-edge maximum is trusted. For the default 6 kV bias and 1 mm axial gap, samples through the middle of each washer gap should be about 6.0 kV/mm. This caught an initial FEniCSx boundary-tagging bug where conductor faces on one side of a plate were missed because Gmsh/DOLFINx boundary coordinates landed infinitesimally outside the ideal plate interval. The FEniCSx boundary marker now uses a tiny geometric tolerance for Dirichlet HV/ground tags, and the deployed Pi FEniCSx result again gives about 6.0 kV/mm in all default washer gaps. The raw point maximum near rounded conductor edges is not yet converged enough for breakdown acceptance. Mesh sweeps can move isolated single-cell spikes between edge features, so the web UI reports a neighborhood-supported Emax based on the 75th percentile of a same-material 3x3 dielectric neighborhood and keeps the raw point maximum as a diagnostic.

The field plot color scale should remain an absolute field-magnitude scale in V/mm. Material breakdown values can be shown as colorbar ticks and margin readouts, but individual dielectric pixels should not be normalized by their own material breakdown value when the colorbar is labeled in kV/mm.

The red fill in the field plot means an HV equipotential conductor, not electric field inside metal. The HV plates and the resistive/ferrite core are both held at the bias voltage in the electrostatic solve and should appear with the same HV cue in the field view. Grounded copper is green. Material/CAD views can still show ferrite as brown and dielectrics by material.

## Mesh Requirements

The production field solver should still move to adaptive meshing or explicit local mesh refinement in a true FEA package. A uniform mesh fine enough to resolve the rounded plate edges would be unnecessarily large in the bulk dielectric, while a uniform mesh sized for the bulk can badly under-resolve the peak field at the radius.

Initial meshing requirements:

- Refine around the rounded inner edge of each ground plate and the rounded outer edge of each high-voltage plate.
- Refine across conductor/dielectric and dielectric/dielectric interfaces, especially where the interface ends near the plate overlap edge.
- Use several elements across the physical edge radius, not just one element spanning the fillet.
- Run peak-field convergence checks by tightening the edge-region mesh until the maximum field and its location stop moving materially.
- Store mesh assumptions and edge-region element sizes with every result summary.
- Treat the current finite-difference peak as a regression/screening number only. Production FEA must demonstrate peak convergence under local edge refinement and should record both the peak value and the physical edge class where it occurs.

## Mirror Symmetry

The alternating stack starts and ends on ground plates and uses uniform plate thicknesses and gaps, so the electrostatic geometry is exactly mirror-symmetric about the center of the middle plate in the idealized axisymmetric model. A full-stack solve is useful for validation. The FEniCSx backend retains the exact half-domain strategy as a reference:

- `mirror_half`: solve one end of the stack through the middle plate, then mirror the field across the center plane. The mirror plane has even-potential symmetry, `dV/dz = 0`, outside regions already fixed as conductor.
- `full_stack`: keep as a reference solve and as a simple browser-compatible fallback.

The half-domain FEniCSx mesh uses the natural Neumann condition at the center plane, doubles the integrated electrostatic energy for total-capacitance reconstruction, and mirrors field samples back into the full browser grid. The same reduction is used for the three symmetric energy-polarization solves that estimate adjacent-bias parasitic capacitance.

A single repeating interior cell is not exact for a finite stack because electrostatic end effects are global, so only the full-stack center plane is exact without an approximation. The web designer nevertheless enables `end_repeat_approx` by default for routine screening because the tested error is small and the Pi runtime improvement is substantial. It solves two regions: (A) the physical axial end through the center of the first bias plate, and (B) that bias-plate center through the center of the next ground plate. Region A is mirrored at the far end. Region B is alternately copied and mirrored across successive bias-plate and ground-plate center planes. Energy is reconstructed as `2 U_A + 2 (N_pairs - 1) U_B`. A one-pair stack falls back to exact `mirror_half` because it has no repeated interior region. Clear the checkbox for the exact mirror-half reference solve.

The mirror-half implementation must retain a same-geometry `full_stack` comparison as a regression check:

- Peak electric field should agree within about 0.5% or 10 V/mm, whichever is looser during early solver development.
- Peak location should map to the same physical edge class after mirroring.
- Reconstructed full-field samples from the half-stack should agree with the full-stack field within about 1%.

## Solver Benchmarks

Before relying on full plate-stack FEA, run simpler geometries with known or semi-known behavior:

1. Infinite parallel plates.
2. Coaxial cylinders.
3. Conducting cylinder over a ground plane.
4. Conducting cylinder inside an equal-clearance grounded shell.
5. Sphere inside an equal-clearance grounded shell.
6. Equal circular conducting disks at fixed potential.
7. Rounded 2D conducting wedge or rounded plate edge.
