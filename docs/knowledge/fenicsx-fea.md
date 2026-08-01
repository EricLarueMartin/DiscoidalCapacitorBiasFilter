# FEniCSx FEA Backend

## Recommendation

Use FEniCSx/DOLFINx as the conforming numerical reference backend, while keeping the finite-difference worker as the fast interactive screening path. The recorded default FEniCSx geometry has passed analytical-limit, exact-symmetry, flat-gap, and five-level rounded-edge convergence checks; selected design geometries still require their own convergence record.

FEniCSx is a good fit for the electrostatic solve because the problem is a scalar elliptic PDE with cylindrical symmetry:

```text
div(epsilon_r grad(V)) = 0
integral 2*pi*r*epsilon_r*grad(V).grad(w) dr dz = 0
```

The important caution is meshing. The maximum field depends on small rounded conductor edges and dielectric interfaces. A FEniCSx solve on a rectangle with conductor nodes merely sampled onto it would not be enough better than the current structured finite-difference screen. The current FEniCSx worker uses a conforming Gmsh/OpenCASCADE r-z dielectric domain with conductor regions removed as holes, so conductor surfaces and rounded edges are actual mesh boundaries. Its validation suite now performs a five-level convergence check using supported peak, field-energy capacitance, and physical peak edge class. That verifies the tested numerical model, not material breakdown or a manufactured assembly.

The JavaScript/Python finite-difference solvers use the correct cylindrical r-z operator and give the expected `V / gap` field through the flat washer gap, but their rounded-edge maxima remain screening values. The FEniCSx validation path provides explicit local refinement and a stop rule based on supported peak, capacitance, and peak edge class. Re-run that path whenever geometry, materials, boundaries, or the selected peak feature changes. The operational procedure is in `validation-runbook.md`.

## Current Implementation

`software/bias_filter/fenicsx_solver.py` implements the first conforming electrostatic FEA path:

- The physical component geometry uses solid bias discs extending to the axis, annular ground plates, and separate core pieces interrupted by each bias disc.
- Gmsh/OpenCASCADE builds the r-z dielectric solve region outside the union of the core pieces and solid bias plates, out to the grounded tube inner radius.
- For peak-field screening, all bias plates and exposed core-segment surfaces are assigned the bias potential, while ground plates and the grounded tube are assigned 0 V. This omits the small operating voltage gradient along the resistive core.
- The DOLFINx weak form uses the cylindrical weighting term, `r * epsilon_r * grad(V) . grad(w)`, so it is not a rectangular-coordinate Laplacian.
- `field_backend.py` runs FEniCSx solves in a separate Python subprocess. This avoids Gmsh signal-handler errors and keeps PETSc/MPI state outside the web server worker thread.
- Results are sampled back onto the same browser result contract used by the finite-difference backend, including solved potential, material labels, and dielectric-region peak fields.
- Every solve returns the normalized parameter set, serialized r-z component profiles, and imposed conductor boundary potentials as an authoritative model record. The CAD, FEA-region, potential, and electric-field review views draw from that returned record rather than rebuilding geometry independently from the browser controls.
- The material map is z-dependent: flat washer slabs occupy only the axial gaps between adjacent plate faces, while epoxy fills the rounded-edge pockets, core-side gap, tube-side gap, and other non-washer voids.
- Result payloads include a neighborhood-supported peak field, a raw point maximum, dielectric-region peaks, and peak-quality diagnostics.
- Result payloads also include a circuit capacitance network. In repeated-cell screening mode, the two solved regions provide the all-bias total; end/interior `Cg` entries are a regional allocation and adjacent `Cpar` uses the local analytical screen. Exact reference mode uses separate full-domain unit basis fields and cross-energy integrals to recover node-resolved `Cg,i` and `Cpar,i,j`.
- For the equal-voltage all-bias excitation, the exact `mirror_half` reference strategy meshes one physical end through the center of the middle plate. The center cut uses the weak form's natural zero-normal-flux boundary condition, energy is doubled, and sampled fields are mirrored back to the full-stack browser grid. `full_stack` remains available for regression comparisons.
- This is exact mirror symmetry only for an excitation that is itself even under reflection. It is not a periodic-cell assumption; arbitrary single-node basis excitations require the full domain, and arbitrary interior cells retain small global end effects.

The first deployed same-geometry field regression on 2026-07-13 used the 13.5 mm default stack and a 50 by 80 browser sampling grid. The then-current `mirror_half` workflow meshed 6.75 mm and completed in 2.433 s versus 5.167 s for `full_stack`, a 2.12x speedup. Total two-terminal capacitance was 79.0094 pF versus 79.0101 pF, a relative difference of 0.00083%. The neighborhood-supported peak was 5.998 kV/mm versus 5.982 kV/mm, a relative difference of 0.267%. These satisfy the initial symmetry-regression tolerances; mesh convergence remains a separate requirement for breakdown acceptance. The node-resolved capacitance algorithm has since been replaced by the basis-field method below, so those timings should not be used for its solve-count estimate.

The `Repeat interior FEA cell` checkbox is enabled by default and selects `end_repeat_approx`. It solves two axial regions: the physical end through the center of the first bias plate, and the first bias-plate center through the center of the second ground plate. The far end is the exact global mirror of the first region. The interior half-cell is copied and mirror-copied across alternating bias and ground center planes until the far-end region begins. The reconstructed ordinary field/capacitance result is marked approximate. Clear the checkbox to use exact `mirror_half` instead.

Repeated-cell screening does not launch single-node basis excitations. The
equal-voltage excitation is reflection-symmetric, so it may assign each end
node one end-region contribution plus one interior-half-cell contribution and
each interior node two half-cell contributions while preserving total all-bias
energy. These per-node entries are a SPICE screening allocation, not extracted
Maxwell row sums. Adjacent `Cpar` is the local analytical core-plus-epoxy
screen; nonadjacent mutual terms are neglected. Clearing the checkbox selects
the exact-reference path, where asymmetric single-node excitations use the full
geometric domain. Only the full-domain solution for an exactly reflected
partner excitation may be reused.

The returned capacitance-network record carries normalized geometry, dielectric
core treatment, representative potential states, full-domain bounds, and the
matrix symmetry-treatment map. The capacitance extraction slide consumes this record
rather than rebuilding a schematic from the main designer controls.

The first six-pair Pi comparison used a 37.5 mm stack and a 50 by 120 browser sampling grid. `full_stack` took 14.079 s, exact `mirror_half` took 7.029 s, and `end_repeat_approx` took 4.049 s. The approximation therefore gave a 3.48x speedup over the full stack while solving 6.75 mm of combined unique axial extent. Its total capacitance was 236.369 pF versus 236.257 pF for the full stack, a 0.047% difference. Its neighborhood-supported peak was 5.966 kV/mm versus 6.009 kV/mm, a 0.728% difference. These results support the approximation as a fast screening option for the tested uniform geometry; they do not replace mesh convergence or full-stack checks for final acceptance.

An older local three-bias polarization solve gave about `0.128 pF` on the
default geometry. It remains a historical cross-check for the analytical
adjacent-`Cpar` screen used by repeated-cell mode. Exact-reference SPICE
networks come from the full Maxwell-matrix extraction below.

## Capacitance Extraction

The total capacitance check uses the same conductor assignment as the field solve:

```text
all bias conductors = V
all ground conductors = 0
C_total = 2 U / V^2
```

In exact-reference mode, the capacitance solve extracts a full physical
capacitor network for the bias nodes and treats the resistive core as
dielectric. For each node `i`, FEniCSx
solves a unit basis field `phi_i`: node `i` is at 1 V and every other bias and
ground conductor is at 0 V. The Maxwell coefficients are then assembled
directly from the basis fields:

```text
Cij = integral 2*pi*r*epsilon_0*epsilon_r
               grad(phi_i).grad(phi_j) dr dz

Cpar,i,j = -Cij                         for i != j
Cg,i = sum(j) Cij
     = Cii - sum(j != i) Cpar,i,j
```

This cross-energy form avoids subtracting two large, nearly equal stored-energy
results to recover a much smaller mutual capacitance. An all-bias excitation
independently checks `sum(Cg,i)`. The complete extraction therefore requires
`N + 1` solves for `N` bias nodes: one solve per basis field plus the all-bias
check. At the current six-node UI limit that is seven solves on one conforming
full-stack mesh.

The browser passes either reconstructed screening network or exact-reference
network to the SPICE endpoint. The repeated network has distinct end/interior
ground capacitors and a repeated adjacent mutual capacitor. The exact network
uses every nonzero extracted mutual capacitor. If no matching FEniCSx solve
exists, the presentation SPICE slide waits rather than silently substituting a
different field result.

Three matrix treatments are available for validation:

- `full` applies no symmetry to the extracted Maxwell matrix.
- `mirror` averages only entries related by exact end-to-end reflection.
- `repeat` first applies exact mirror averaging, then shares fully interior
  mutual terms having the same axial separation. End-involving terms remain
  distinct, and the final `Cg` values use one end class and one interior class.

The potential viewer samples the solved FEniCSx scalar field `uh` in the
dielectric domain. FEniCSx does not mesh conductor interiors, so the viewer
fills those regions from the same serialized model and their imposed
Dirichlet values: bias plates and core surfaces at `V`, ground plates and tube
at `0 V`. The electric-field viewer evaluates and colors `|grad(V)|` only in
dielectric regions. Its red and green conductor overlays are separately
labeled boundary-potential cues and are not values from the electric-field
color scale.

For all calculated-core Cpar cases, the basis solves include each
inter-plate core piece as dielectric rather than tying its outer surface to HV.
The solid bias discs are the stage electrodes and each receives its specified
Dirichlet voltage. This is both the physical topology and the full-area
electrode assumed by the analytic `epsilon A/d` core calculation. For MELF
presets, the core permittivity is modeled as:

```text
eps_eff = eps_substrate / (1 - film_fill_factor)
```

The default 0207 values are `eps_substrate = 9.8` and `film_fill_factor = 0.50`, giving `eps_eff = 19.6`. This approximates the shielding/capacitance increase from a spiral metal-film resistor without explicitly modeling the proprietary trim path.

### 2026-07-30 capacitance-matrix strategy verification

An earlier polarization implementation recovered `Cpar` by subtracting large
single-node and pair-node energies. Reusing a nominally equivalent self-energy
from another location exposed enough unstructured-mesh bias to perturb the
small difference. Direct basis-field cross energies removed that conditioning
problem.

A matched Pi campaign tested complete full-stack matrices with no symmetry,
exact mirror averaging, and mirror plus repeated-interior constraints for two
through five bias plates:

| Bias plates | Axial analytic Cpar | Full | Mirror | Repeat | FEA / analytic |
|---:|---:|---:|---:|---:|---:|
| 2 | 0.267643 pF | 0.127969 pF | 0.127969 pF | 0.127969 pF | 0.4781 |
| 3 | 0.267643 pF | 0.127934 pF | 0.127934 pF | 0.127934 pF | 0.4780 |
| 4 | 0.267643 pF | 0.128130 pF | 0.128130 pF | 0.128130 pF | 0.4787 |
| 5 | 0.267643 pF | 0.127907 pF | 0.127907 pF | 0.127907 pF | 0.4779 |

The reported value is average adjacent `Cpar`; the stored campaign also checks
each adjacent pair. All three treatments agree to the precision recorded in
`simulations/axisymmetric/outputs/cpar-strategy-validation.json`. For two
plates, enabling or disabling repeating-interior treatment has no effect.

The roughly `0.478` ratio is physically expected for this geometry. The
intervening grounded annulus intercepts much of the non-axial flux, while the
simple `epsilon A/d` estimate assumes an unobstructed axial field.

### Wide-disc analytical-limit verification

A second three-plate campaign sets the core, epoxy, and washer to the same
`epsilon_r = 3.4`, makes each ground plate a narrow 4 mm outer annulus, and
moves the annulus and grounded tube outward while increasing the bias-disc
diameter. Edge and shielding contributions then become progressively smaller
than the broad axial-field area:

| Outer diameter | Ground ID | Bias OD | Axial analytic Cpar | FEA Cpar | FEA / analytic |
|---:|---:|---:|---:|---:|---:|
| 24 mm | 20 mm | 22 mm | 2.101672 pF | 1.514071 pF | 0.7204 |
| 40 mm | 36 mm | 38 mm | 6.809418 pF | 5.716282 pF | 0.8395 |
| 80 mm | 76 mm | 78 mm | 30.348148 pF | 27.993554 pF | 0.9224 |
| 120 mm | 116 mm | 118 mm | 70.700257 pF | 67.084695 pF | 0.9489 |

The monotonic approach toward unity is the required limiting behavior. The raw
results are in
`simulations/axisymmetric/outputs/cpar-wide-disc-validation.json`.

Re-run both campaigns on a FEniCSx host with:

```bash
python3 software/bias_filter/fenicsx_solver.py --validate-capacitance-strategies
python3 software/bias_filter/fenicsx_solver.py --validate-cpar-wide-disc-limit
```

### Cg matrix-treatment verification

A single-node unit excitation must not be mistaken for capacitance to ground.
When bias node `i` is driven and every other bias node is held at 0 V, the
energy result is the Maxwell diagonal:

```text
Cii = Cg,i + sum(j != i) Cpar,i,j
```

The grounded neighboring bias plates therefore make `Cii` larger than the
desired shunt capacitance. The production capacitance matrix removes this by
using its row sum, equivalently `Cg,i = Cii - sum(Cpar,i,j)`.

Two additional FEniCSx matrices now provide an explicit cross-check:

1. A one-bias geometry has no other bias electrode, so `2 U1 / V^2` is
   directly `Cg`.
2. An exact-reflection three-bias matrix uses middle-only (`Cm`),
   neighbors-only (`Cn`), and all-bias (`Ca`) states reconstructed from its
   basis fields. The same polarization identity used for adjacent `Cpar` gives

```text
Cg,middle = (Cm - Cn + Ca) / 2
          = Cm - Nneighbors Cpar
```

For the default geometry on the Pi, the direct one-bias result is
39.915605 pF. The three-bias middle-only diagonal is 40.030002 pF, but it
contains 0.255868 pF of mutual capacitance to two neighbors. Subtraction gives
39.774133 pF, 0.354% below the one-bias result. This small residual difference
is expected because the one-bias stack and the middle cell of a three-bias
stack have different finite end/fringing environments; it is not the
grounded-neighbor overcount.

For two bias plates, the second single-node field is the exact axial reflection
of the first. The backend now solves one basis field, interpolates its reflected
potential onto the full-stack function space, and uses that reflected field
directly in the Maxwell cross-energy integral. It does not run the redundant
second PDE solve. The all-bias solve remains an independent total-capacitance
check; it is not used to recover small `Cpar` by subtracting large energies.

The same method applies to three plates: solve one end basis and the center
basis, reflect the first basis for the far end, then solve all-bias as the
total check. The default Pi audit found:

| Matrix | Potential solves | Basis representatives | Mean/position Cg | Adjacent Cpar |
|---|---:|---|---|---:|
| 2 bias | 2 instead of 3 | `[end, reflected end]` | 39.827617 pF at both nodes | 0.127969 pF |
| 3 bias | 3 instead of 4 | `[end, center, reflected end]` | 39.857434, 39.774133, 39.857434 pF | 0.127934 pF |

The two-bias reflected result matches the reflection-averaged unreduced matrix
to `5.8e-16 pF`. For three plates, adjacent `Cpar` agrees within `8e-12 pF`;
the largest matrix-entry difference is 0.004662 pF because the reflected field
is interpolated between non-mirrored unstructured meshes. This is about 0.012%
of stage `Cg`. Comparing plate counts, the three-plate end is 0.0749% above the
two-plate value and the three-plate center is 0.1343% below it.

For two or three plates, the repeating-interior checkbox creates no additional
equivalence class beyond exact reflection: two plates have no interior node,
and three plates have only one. Larger matrices may still apply repeated
interior classes after extraction.

The matching `Cg` campaign includes one through five bias plates. A one-plate
model has no mutual capacitance, so it tests node-to-ground extraction without
any `Cpar` bookkeeping. Each case starts from the same full-stack basis fields
and compares:

- `full`: raw node values, with no matrix symmetry imposed.
- `mirror`: exact end-to-end reflection averaging.
- `repeat`: exact reflection plus repeated-interior matrix constraints.

The ordinary test geometry uses a 2.2 mm core OD, 5.1 mm ground ID, 20 mm flat
washer OD, 21.5 mm rounded bias OD, 26 mm tube ID, 1.5 mm washers, 1.5 mm
plates, `epsilon_r = 10` alumina, and `epsilon_r = 3.7` epoxy. The analytical
comparison is the two parallel washer capacitors seen by one bias plate:

```text
r_inner = max(washer_ID, ground_ID) / 2
r_outer = min(washer_OD, bias_OD) / 2
Cg,analytic = 2 epsilon_0 epsilon_washer
              pi (r_outer^2 - r_inner^2) / washer_thickness
```

| Bias plates | Full mean Cg | Mirror mean Cg | Repeat mean Cg | Largest full/mirror node change | Largest repeat/mirror node change |
|---:|---:|---:|---:|---:|---:|
| 1 | 39.915605 pF | 39.915605 pF | 39.915605 pF | 0 | 0 |
| 2 | 39.827617 pF | 39.827617 pF | 39.827617 pF | 0.0372% | 0 |
| 3 | 39.829667 pF | 39.829667 pF | 39.829667 pF | 0.0154% | 0 |
| 4 | 39.800706 pF | 39.800706 pF | 39.800706 pF | 0.0658% | 0 |
| 5 | 39.797938 pF | 39.797938 pF | 39.797938 pF | 0.0265% | 0.0460% |

The averages agree to the shown precision because all treatments preserve the
all-bias total. Node-by-node differences were also checked so an incorrect
distribution could not be hidden by that invariant. The raw two-plate solve
gave 39.812799 and 39.842436 pF; exact reflection correctly makes both
39.827617 pF. The maximum observed symmetry correction was 0.0658%, consistent
with independent unstructured-mesh discretization error rather than a physical
asymmetry. The repeated-interior approximation changed an individual node by
at most 0.0460% for the tested range.

The two-washer analytical value is 33.049415 pF, so ordinary-geometry FEA is
about 20.4% to 20.8% higher. This is expected because the finite washer has
inner- and outer-edge fringing, while the simple expression retains only the
uniform axial field. Raw results, including every node value and the serialized
geometry sent to FEniCSx, are in
`simulations/axisymmetric/outputs/cg-strategy-validation.json`.

### Cg two-washer analytical limit

The limiting test deliberately separates analytical convergence from the
multi-plate matrix test. It uses one solid bias disc centered between two
ground plates, so exact center-plane mirror symmetry reduces the model to one
washer and one energy solve. The energy is doubled before applying
`C = 2U/V^2`. All dielectric regions use `epsilon_r = 3.4`, preventing a
material boundary from obscuring the geometry limit.

Fixed dimensions are:

- core OD 2.0 mm and ground/washer ID 2.2 mm, giving 0.10 mm radial clearance;
- washer and plate thickness 1.5 mm;
- washer OD equal to bias OD;
- ground/tube OD 4 mm greater than bias OD, giving 2 mm radial tube clearance;
- solved mirror-half z extent 3.75 mm;
- fine/coarse mesh targets 0.0125/0.050 mm.

| Bias/washer OD | Ground/tube OD | Analytical two-washer Cg | FEA Cg | FEA / analytic | Solve time |
|---:|---:|---:|---:|---:|---:|
| 12 mm | 16 mm | 4.387031 pF | 6.355110 pF | 1.4486 | 9.6 s |
| 24 mm | 28 mm | 18.005867 pF | 21.695583 pF | 1.2049 | 19.8 s |
| 40 mm | 44 mm | 50.287554 pF | 56.268596 pF | 1.1189 | 34.8 s |
| 80 mm | 84 mm | 201.607962 pF | 213.313912 pF | 1.0581 | 75.4 s |
| 120 mm | 124 mm | 453.808641 pF | 471.238484 pF | 1.0384 | 119.6 s |

The ratio approaches one monotonically from above. That direction is expected:
fringing adds capacitance, but its contribution grows more slowly than the
broad axial-field area. The result therefore checks both the FEA energy scale
and the factor of two for the two washers.

The first version of this campaign did not complete, and that history is
retained because it explains the corrected harness:

1. A three-bias full-stack, multi-basis sweep with a 0.01 mm radial gap reached
   about 5.68 GiB RSS after 6 minutes 49 seconds at the 120 mm case and was
   stopped before swap or OOM.
2. Capping the same formulation at 64 mm still reached about 5.65 GiB, and a
   40 mm batched attempt reached about 5.68 GiB.
3. Retained PETSc allocations were initially suspected. Completed single-case
   runs showed the dominant problem was the 0.01 mm gap forcing 0.006/0.024 mm
   fine/coarse targets over the widening radial domain.
4. The first isolated-subprocess launch also exposed an unrelated
   `UnboundLocalError` caused by a redundant local `sys` import. Removing that
   shadowing import fixed the runner; it did not change the FEA equations.
5. An exact-mirror 0.01 mm-gap sweep then completed through 64 mm and converged
   from 1.4424 to 1.0729, confirming the physics but also confirming needless
   overrefinement.
6. The final 0.10 mm-gap campaign above completed through 120 mm. Each diameter
   ran in a fresh subprocess to release Gmsh/PETSc state, and swap stayed zero.

The final and tight-gap raw records are
`simulations/axisymmetric/outputs/cg-wide-disc-validation.json` and
`cg-wide-disc-validation-tight-gap.json`. Re-run the checks with:

```bash
python3 software/bias_filter/fenicsx_solver.py --validate-cg-strategies
python3 software/bias_filter/fenicsx_solver.py --validate-cg-wide-disc-limit
```

## Regression Checks

### Full deployed validation campaign, 2026-07-31

A fresh deployed-Pi campaign reran all capacitance-strategy and analytical-limit
checks and added one reproducible field validation entry point:

```bash
python3 software/bias_filter/fenicsx_solver.py --validate-field-suite
```

That suite checks the flat-gap `E = V/g` result, full-stack versus exact-mirror
peak and smooth-interior field samples, the operational repeat-cell
approximation error, physical peak edge class, and rounded-edge mesh
convergence. All final gates passed. The campaign also caught and fixed a gap
sweep normalization defect before accepting any result; requested gap values
had previously been overwritten by derived washer geometry.

The complete provenance, acceptance metrics, raw JSON, timing files, and
defect/fix history are in
`simulations/axisymmetric/outputs/validation-2026-07-31/README.md`.

On 2026-06-25, the first deployed FEniCSx solve failed a simple flat-gap sanity check: with 6 kV across a 1 mm washer gap, sampled fields in the washer overlap were only a few to a few tens of V/mm in alternating gaps. The issue was not the cylindrical weak form or unit conversion. Gmsh/DOLFINx boundary coordinates on one side of several conductor faces landed infinitesimally outside the ideal plate interval, so exact coordinate classification missed those Dirichlet conductor tags.

`fenicsx_solver.py` now uses a tiny tolerance when classifying FEA boundary nodes for HV and ground Dirichlet conditions. After that fix, the deployed Pi FEniCSx solve gives mid-washer-gap samples of about 6000 V/mm in each default 1 mm gap, as expected from `E = V / gap`.

Keep this as a required regression check for every field-solver change:

- For each flat washer gap, sample near the radial middle of the plate overlap and axial middle of the gap.
- Compare against `bias_voltage_v / plate_gap_mm`.
- The sample should be close before interpreting rounded-edge peak fields.

The frontend field plot was also changed to use a single absolute `V/mm` color scale for all dielectric pixels. Breakdown strengths remain reference ticks and margin readouts; they should not be used to normalize individual pixel colors because that makes an absolute kV/mm colorbar misleading.

On the deployed Pi, health reports FEniCSx dependencies installed and ready:

```text
dolfinx 0.9.0
ufl 2024.2.0
mpi4py 4.0.3
petsc4py 3.22.4
gmsh 4.13.1.dev1
```

The Pi service is currently started with requested/effective default solver `fd`, so `Backend auto` follows the finite-difference worker. Use `FEniCSx required` when deliberately requesting the conforming FEA path.

An early same-parameter API comparison before the flat-washer epoxy-pocket correction found FD and FEniCSx peak values differing substantially. That result should be treated as historical context only. After the dielectric correction, rounded-edge pocket fields should generally be classified as epoxy rather than washer, and new comparisons should be recorded only with solver version, material-map version, mesh settings, supported peak, raw peak, and physical peak edge class.

## Adaptive Meshing

DOLFINx supports mesh refinement primitives. Its mesh module is described as handling creation, refining, and marking of meshes, and it exposes `dolfinx.mesh.refine` plus `uniform_refine`.

That is not the same as a complete black-box adaptive meshing workflow. For this filter, the adaptive loop should be explicit:

1. Generate the initial conforming r-z geometry in Gmsh.
2. Apply small target element sizes at rounded HV outer edges, rounded ground inner edges, and dielectric-interface endpoints near plate overlap boundaries.
3. Solve the axisymmetric weak form in DOLFINx.
4. Mark cells using peak field, field gradient, or a flux-jump / residual estimator.
5. Refine marked cells or regenerate the Gmsh mesh with tighter size fields.
6. Stop when peak field and peak location converge.

This is preferable to relying on a single global mesh size because low-field bulk epoxy does not need the same resolution as the edge-radius neighborhood.

Convergence should be judged by both the numeric peak and the physical edge class. For this filter, a peak that jumps between the HV outer rounded edge and the ground inner rounded edge as mesh settings change is not converged, even if the scalar value changes only modestly.

## Pi Package Reality

The Raspberry Pi is Debian trixie on arm64. Package metadata on the Pi has candidate packages for:

```text
fenicsx
python3-dolfinx
gmsh
python3-gmsh
python3-mpi4py
python3-petsc4py
```

The install command used by this project path is:

```bash
sudo apt install fenicsx gmsh python3-gmsh python3-dolfinx
```

Debian currently offers DOLFINx 0.9 packages on the Pi, while the FEniCS project website lists FEniCSx 0.11 as the latest stable release in June 2026. The repository code should therefore avoid depending on newest-only API details unless tested on the Pi package version.

## Repository Integration

The integration is:

- `software/bias_filter/fenicsx_solver.py`: optional dependency/readiness probe and FEniCSx solver entry point.
- `software/bias_filter/field_backend.py --solver fd`: finite-difference screening solver.
- `software/bias_filter/field_backend.py --solver auto`: use the backend's automatic solver choice.
- `software/bias_filter/field_backend.py --solver fenicsx`: explicitly require the FEniCSx worker and fail loudly if it is not ready.

This keeps the web app usable while the FEA path is developed.

## Sources

- FEniCS download page: FEniCSx 0.11 is latest stable as of June 2026, and new users are recommended to use FEniCSx rather than legacy FEniCS: <https://fenicsproject.org/download/>
- DOLFINx mesh API: creation, refining, and marking of meshes, including `refine` and `uniform_refine`: <https://docs.fenicsproject.org/dolfinx/main/python/generated/dolfinx.mesh.html>
- DOLFINx Gmsh demo: imports Gmsh geometry into DOLFINx with `gmshio.model_to_mesh`: <https://docs.fenicsproject.org/dolfinx/main/python/demos/demo_gmsh.html>
- DOLFINx Poisson demo: shows the standard weak-form and `LinearProblem` pattern: <https://docs.fenicsproject.org/dolfinx/main/python/demos/demo_poisson.html>
