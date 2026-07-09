# FEniCSx FEA Backend

## Recommendation

Use FEniCSx/DOLFINx as an optional backend, but keep the finite-difference worker available as the fast screening path until the FEniCSx peak-field convergence workflow is benchmarked.

FEniCSx is a good fit for the electrostatic solve because the problem is a scalar elliptic PDE with cylindrical symmetry:

```text
div(epsilon_r grad(V)) = 0
integral 2*pi*r*epsilon_r*grad(V).grad(w) dr dz = 0
```

The important caution is meshing. The maximum field depends on small rounded conductor edges and dielectric interfaces. A FEniCSx solve on a rectangle with conductor nodes merely sampled onto it would not be enough better than the current structured finite-difference screen. The current FEniCSx worker uses a conforming Gmsh/OpenCASCADE r-z dielectric domain with conductor regions removed as holes, so conductor surfaces and rounded edges are actual mesh boundaries. It still needs a peak-convergence loop before its supported or raw maximum should be treated as an acceptance value.

The remaining main simulation blocker is convergence, not package availability. The JavaScript/Python finite-difference solvers use the correct cylindrical r-z operator and give the expected `V / gap` field through the flat washer gap, but rounded-edge maxima remain sensitive to discretization. The FEniCSx path provides the conforming mesh needed for comparison; next it needs explicit local refinement and a stop rule based on peak-field and peak-location convergence.

## Current Implementation

`software/bias_filter/fenicsx_solver.py` implements the first conforming electrostatic FEA path:

- Gmsh/OpenCASCADE builds the r-z dielectric solve region between the conductive core radius and grounded tube inner radius.
- HV plates, ground plates, the conductive core boundary, and the grounded tube boundary are treated as equipotential conductor boundaries.
- The DOLFINx weak form uses the cylindrical weighting term, `r * epsilon_r * grad(V) . grad(w)`, so it is not a rectangular-coordinate Laplacian.
- `field_backend.py` runs FEniCSx solves in a separate Python subprocess. This avoids Gmsh signal-handler errors and keeps PETSc/MPI state outside the web server worker thread.
- Results are sampled back onto the same browser result contract used by the finite-difference backend, including material labels and dielectric-region peak fields.
- The material map is z-dependent: flat washer slabs occupy only the axial gaps between adjacent plate faces, while epoxy fills the rounded-edge pockets, core-side gap, tube-side gap, and other non-washer voids.
- Result payloads include a neighborhood-supported peak field, a raw point maximum, dielectric-region peaks, and peak-quality diagnostics.
- Result payloads also include capacitance checks. The ordinary field solve reports total two-terminal HV-to-ground capacitance from `C = 2U/V^2`. A separate local three-bias-plate solve estimates adjacent-bias parasitic capacitance.

## Capacitance Extraction

The total capacitance check uses the same conductor assignment as the field solve:

```text
all bias conductors = V
all ground conductors = 0
C_total = 2 U / V^2
```

Adjacent-bias `Cpar` is not extracted from that solve because all bias plates are at the same voltage, so bias-to-bias mutual capacitance stores no energy. The deployed estimate uses a separate local representative solve with three bias plates:

```text
Solve A: middle bias = 1 V, neighboring bias plates = 0 V, grounds = 0 V
Solve B: all three bias plates = 1 V, grounds = 0 V

C_middle_to_all_zero = 2 U_A
C_bias_to_ground_per_plate ~= 2 U_B / 3
Cpar_adjacent ~= (C_middle_to_all_zero - C_bias_to_ground_per_plate) / 2
```

The final division by two is because the middle bias plate couples to two adjacent bias plates in the local symmetric model. This is an energy-difference estimate rather than a full capacitance-matrix charge extraction. It should be treated as a useful first-draft sanity check; a later production model should assemble conductor charges on individual plate boundaries and report the capacitance matrix directly.

For MELF presets, the three-bias solve includes the core as dielectric rather than tying the whole core surface to HV. The MELF core permittivity is modeled as:

```text
eps_eff = eps_substrate / (1 - film_fill_factor)
```

The default 0207 values are `eps_substrate = 9.8` and `film_fill_factor = 0.50`, giving `eps_eff = 19.6`. This approximates the shielding/capacitance increase from a spiral metal-film resistor without explicitly modeling the proprietary trim path.

## Regression Checks

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
