# Edge-Effect Approximation

## Current Concern

Sharp capacitor-plate edges can raise the local electric field above the simple parallel-plate estimate. Broken SMD capacitors show that real foils can be very thin, so the plate edge should not be treated as a needle tip, but the local field should still be screened before committing to geometry.

## Boundary Condition

The capacitor plates are conductors held at approximately fixed potential, not insulating disks with prescribed uniform surface charge. This matters because an equipotential disk has nonuniform surface charge that crowds toward edges; a sharp ideal conductor edge has a singular local field. Rounded metal edges regularize that singularity.

The commonly seen disk-axis expression:

```text
E_z = sigma / (2 epsilon) * (1 - z / sqrt(R^2 + z^2))
```

is for a uniformly charged disk. It is useful as a textbook finite-disk field check, but it is not the right boundary condition for the metal plates in this filter.

## Web Screening Formula

Use the axial plate-gap field as the first baseline:

```text
E0 = V / g
```

where `V` is the bias voltage across a local HV-to-ground gap and `g` is the plate gap.

The web presentation specifies rounded edge diameter relative to plate thickness:

```text
d_edge_percent = 100 d_edge / t_plate
r_edge = t_plate d_edge_percent / 200
```

For local rounded-edge screening, evaluate each relevant nearest opposite-conductor
clearance as its own case:

```text
axial: s = plate_gap
core side: s = ground_inner_radius - core_radius
tube side: s = tube_inner_radius - hv_outer_radius
```

Omit the tube-side term when no grounded tube is present. This is intentionally
simple: it asks which nearby grounded conductor could set the local edge scale,
but it is not a conservative guarantee. The core side must be kept separate from the tube side because identical
radial gaps do not imply identical fields. The smaller HV core radius gives a
higher coaxial-cylinder field than the larger HV disc radius.

Then approximate the rounded rim as a long conducting cylinder of radius `r_edge`. This `r_edge` is the physical fillet radius, not the radial position of the core, plate, or tube. This is a local 2D approximation: it does not include the torus major radius or the cylindrical-coordinate `1/r` geometry of the full annular edge. Therefore two radial cases with the same `s` and `r_edge` will get the same local edge-cylinder value even when their actual torus major radii differ.

Two limiting conductor environments are useful:

1. One-sided ground: the rounded rim faces an opposing grounded plane across clearance `s`.
2. Surrounding ground: the rounded rim is inside a coaxial grounded shell whose inner surface is also clearance `s` away.

The one-sided cylinder-plane estimate is:

```text
xi = acosh(1 + s / r_edge)
E_cyl_plane ~= V / (r_edge xi) coth(xi / 2)
```

where `r_edge` is the rounded-edge radius. A 100 percent edge diameter means the rounded diameter equals the plate thickness, so the radius is half the thickness.

The surrounding-ground coaxial estimate is:

```text
E_cyl_shell ~= V / (r_edge ln(1 + s / r_edge))
```

For the radial cases, also compare the corresponding axisymmetric coaxial-cylinder baseline:

```text
E_coax_inner = V / (a ln((a + s) / a))
```

where `a` is the energized inner-conductor radius for that radial gap. This is
not the rounded-edge approximation; it is a separate radial baseline that uses
the actual cylindrical radius from the symmetry axis. For the core-side case,
`a = core_radius`; for the tube-side case, `a = hv_outer_radius`. With equal
radial gaps, the core-side value is larger because the logarithmic field is
evaluated at the smaller conductor radius.

For traceability, the slide also reports the approximate torus major radius of
the edge circle center:

```text
core-side ground inner edge: R_major ~= ground_inner_radius + r_edge
tube-side HV outer edge: R_major ~= hv_outer_radius - r_edge
```

Those radii are displayed to make the limitation visible. They are not yet used
in an analytic toroidal correction. When `R_major` is not much larger than
`r_edge`, this local 2D approximation can fail badly. The real
toroidal/cylindrical-coordinate edge check should come from the axisymmetric FEA
backend.

The web estimate uses a quick maximum:

```text
E_edge ~= max(E0, E_cyl_plane, E_cyl_shell, E_coax_inner)
```

where `E0 = V / s`. The controlling web value is the largest quick estimate
across the axial, core-side, and tube-side checks. It is an
order-of-magnitude cross-check, not a conservative design limit.

An even more pessimistic analytic envelope is a sphere of radius `r_edge` inside a concentric grounded sphere whose inner radius is `r_edge + s`:

```text
E_sphere_shell = V (r_edge + s) / (r_edge s)
```

This is not used as the default web metric because it concentrates flux in 3D around a point-like conductor rather than along a long edge, but it is a useful reference case.

For `s >> r_edge`, both cylinder estimates have a logarithmic denominator. The one-sided plane case reduces approximately to:

```text
E_cyl_plane ~= V / (r_edge ln(2s / r_edge))
```

For `s << r_edge`, they tend back toward the parallel-plate scale.

## Interpretation

- This is an order-of-magnitude screening estimate, not a certification calculation.
- It is most useful for comparing plate gap and edge-diameter choices.
- The previous isolated-rim cutoff was too detached from the local gap geometry.
- It may overestimate many real stack cases because it replaces an open 3D/axisymmetric fringe volume with either a full opposing plane or an enclosing grounded shell at the nearest clearance.
- It may also underpredict when toroidal curvature matters, especially when `R_major / r_edge` is not large.
- A comparison-principle argument is strongest for total capacitance or field energy: adding closer/larger grounded boundaries tends to increase capacitance at fixed voltage. That does not automatically prove a strict pointwise upper bound on the peak field at every part of the rounded edge.
- The estimate could still underpredict if the real geometry creates a smaller effective clearance, a grounded corner, a dielectric interface that concentrates displacement field, or multiple nearby grounded surfaces acting together.
- It should be replaced or calibrated once finite-element results exist.
- Values near or above roughly `2 kV/mm` in epoxy or washer regions should trigger either a geometry change or an FEA check.

## Possible Deformation Argument

A useful mental deformation is:

1. Start from the real rounded edge and identify the nearest grounded conductor.
2. Replace the nearby grounded conductor by an infinite grounded plane at that distance. This removes escape routes for fringe fields and usually increases local crowding.
3. Replace the remaining open space by a coaxial grounded shell at the same distance. This is more severe because every azimuthal direction sees ground at the nearest clearance.
4. Use the larger of the one-sided and surrounding-ground cylinder estimates as a rough context value.

This is useful intuition, but it is not a conservative design screen and not a mathematical proof for the actual finite plate stack. FEA should compare the true stack against these benchmark deformations.

Another reference deformation is to start with a ball of radius `r_edge` inside a concentric grounded sphere at clearance `s`. Stretching the ball into a disk-like conductor while maintaining equal ground distance might smear charge over a larger area, but that does not prove a pointwise peak-field bound for the actual toroidal filter edge.

The slide deck should show this deformation visually rather than only as text: sphere-in-shell, stretched conductor, then the rounded filter rim with no closer ground boundary.

## Toroidal Analytic Search

Toroidal coordinates provide separable Laplace-equation solutions for circular toroidal coordinate surfaces using toroidal harmonics. That is the closest analytic family found so far for ring-like conductors. I have not found a simple closed-form result for a circular cross-section torus inside a square or rectangular cross-section grounded ring. Such a geometry should be treated as a benchmark for numerical FEA rather than a ready analytic replacement.

## Solvable Benchmark Geometries

Use these as regression tests for finite-element or finite-difference solvers before trusting the full plate stack:

1. Infinite parallel plates: checks baseline field `E = V / g`.
2. Coaxial cylinders: checks logarithmic radial field `E(a) = V / (a ln(b / a))`.
3. Cylinder over infinite ground plane: checks the local edge formula above, including the `acosh` transition from gap-limited to log-limited behavior.
4. Sphere inside concentric grounded sphere: checks the deliberately pessimistic 3D envelope `E = V (a + s) / (a s)`.
5. Two equal circular conducting disks at fixed potential: checks constant-potential disk behavior and capacitance against Love-equation literature.
6. Rounded 2D conducting wedge or rounded plate edge: checks singular-edge convergence as the mesh resolves the geometric cutoff.

## Literature Breadcrumbs

- The finite parallel conducting disk problem is a constant-potential boundary-value problem commonly formulated through Love-type integral equations; see Felderhof, "Derivation of the Love equation for the charge density of a circular plate condenser", arXiv:1309.3662.
- Unequal circular disk capacitors generalize the same constant-potential disk problem; see Paffuti et al., "Circular plate capacitor with different disks", arXiv:1607.05496.
- Corner and edge fields of ideal conductors are singular before a geometric cutoff is introduced; see Majumdar and Mukhopadhyay, "Computation of Electrostatic Field near Three-Dimensional Corners and Edges", arXiv:physics/0604033.

## Follow-Up

Run local 2D axisymmetric FEA for:

1. Ground-plate inner rounded edge.
2. HV-plate outer rounded edge.
3. Thin-foil edge radii below `plate_thickness / 2`.
4. The same cases with and without the outer grounded tube.
