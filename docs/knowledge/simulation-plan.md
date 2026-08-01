# Simulation Plan

## Primary Model Class

Use axisymmetric electrostatic simulations where possible. The geometry is intended to be cylindrical, so 2D r-z simulations should capture the dominant field behavior before moving to full 3D.

The next electrical extension is an axisymmetric electroquasistatic FEniCSx
solve of the full complex nodal admittance matrix. It must solve distributed
conduction and displacement current together and compare directly with the
existing Maxwell-capacitance SPICE ladder. See
[`distributed-admittance.md`](distributed-admittance.md).

After that formulation passes its analytical, electrostatic, reciprocity,
passivity, mesh, and noise limits, begin the controlled full-3D comparison in
[`axisymmetry-sensitivity.md`](axisymmetry-sensitivity.md). This study concerns
rotational symmetry about the axis; it is separate from axial mirror and
repeating-cell validation.

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

For reviewability, the backend result is also the display contract. Each solve
returns the normalized parameters, serialized component profiles, material
regions, boundary potentials, sampled solved potential, and sampled field.
The CAD, FEA model-region, potential, and field-overlay views consume that
returned model. They must not reconstruct a second geometry from the original
browser inputs after the backend has normalized those inputs.

The analytical capacitance sanity check uses the simple washer-overlap approximation. The FEniCSx backend now extracts the node-resolved `Cg` and `Cpar` network from unit basis fields and Maxwell cross-energy integrals. Both field and capacitance solves use the same z-dependent dielectric map: washer permittivity only inside flat annular washer slabs between plate faces, and epoxy permittivity around the rounded plate edges. This matters for edge-stress estimates because the rounded-edge high-field region is usually in epoxy, not in the washer.

The flat washer-overlap regions must verify against the expected `E = V / gap` baseline before any rounded-edge maximum is trusted. For the default 6 kV bias and 1 mm axial gap, samples through the middle of each washer gap should be about 6.0 kV/mm. This caught an initial FEniCSx boundary-tagging bug where conductor faces on one side of a plate were missed because Gmsh/DOLFINx boundary coordinates landed infinitesimally outside the ideal plate interval. The FEniCSx boundary marker now uses a tiny geometric tolerance for Dirichlet HV/ground tags. The 2026-07-31 field suite also passed its five-level supported-peak and field-energy capacitance convergence gates for the recorded default validation geometry. The raw point maximum remains diagnostic, and any selected design still requires a geometry-specific convergence run before the value is used in a breakdown-margin argument.

The field plot color scale should remain an absolute field-magnitude scale in V/mm. Material breakdown values can be shown as colorbar ticks and margin readouts, but individual dielectric pixels should not be normalized by their own material breakdown value when the colorbar is labeled in kV/mm.

The field plot colors only dielectric samples with the absolute electric-field
scale. Conductors are overlaid afterward from the backend model: red denotes
the imposed bias/core boundary potential and green denotes the imposed
ground/tube boundary potential. An explicit legend separates these voltage
cues from the electric-field colorbar. The Potential tab plots the sampled
scalar solution and fills conductor interiors with their imposed boundary
values. Physically, each bias plate is a solid disc extending to the axis and
the resistive/ferrite core is divided into pieces by those discs. For the
peak-field model, the bias discs and exposed surfaces of all core pieces are
assigned the bias voltage; the small operating voltage gradient through the
resistive path is omitted.

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

The half-domain FEniCSx mesh uses the natural Neumann condition at the center plane, doubles the integrated electrostatic energy for total-capacitance reconstruction, and mirrors field samples back into the full browser grid. Node-resolved capacitance basis excitations generally are not mirror-symmetric, so their Maxwell matrix is extracted on a full-stack mesh; exact reflection can then be imposed by averaging reflected matrix entries.

A single repeating interior cell is not exact for a finite stack because electrostatic end effects are global, so only the full-stack center plane is exact without an approximation. The web designer nevertheless enables `end_repeat_approx` by default for routine screening because the tested error is small and the Pi runtime improvement is substantial. It solves two regions: (A) the physical axial end through the center of the first bias plate, and (B) that bias-plate center through the center of the next ground plate. Region A is mirrored at the far end. Region B is alternately copied and mirrored across successive bias-plate and ground-plate center planes. For `N_bias` bias plates and `N_bias + 1` ground plates, energy is reconstructed as `2 U_A + 2 (N_bias - 1) U_B`. A one-bias-plate stack falls back to exact `mirror_half` because it has no repeated interior region. Clear the checkbox for the exact mirror-half reference solve.

The mirror-half implementation must retain a same-geometry `full_stack` comparison as a regression check:

- Peak electric field should agree within about 0.5% or 10 V/mm, whichever is looser during early solver development.
- Peak location should map to the same physical edge class after mirroring.
- Reconstructed full-field samples from the half-stack should agree with the full-stack field within about 1%.

Capacitance-network consistency and analytical limiting behavior are tested
separately. The matrix campaign uses ordinary geometry with one through five
bias plates and compares raw full-matrix, exact reflected, and
repeated-interior node values. The analytical `Cg` limit uses one bias plate
between two ground plates with exact mirror symmetry, ground ID close to core
OD, and increasing bias/washer OD. This avoids spending Pi memory on plate
counts that add no information to the parallel-plate limit. The completed
12-to-120 mm sweep approaches the two-washer analytical result monotonically,
from FEA/analytic 1.4486 to 1.0384, with zero swap use. See
`docs/knowledge/fenicsx-fea.md` for dimensions, failed attempts, and raw-result
paths.

## Solver Benchmarks

Before relying on full plate-stack FEA, run simpler geometries with known or semi-known behavior:

1. Infinite parallel plates.
2. Coaxial cylinders.
3. Conducting cylinder over a ground plane.
4. Conducting cylinder inside an equal-clearance grounded shell.
5. Sphere inside an equal-clearance grounded shell.
6. Equal circular conducting disks at fixed potential.
7. Rounded 2D conducting wedge or rounded plate edge.
