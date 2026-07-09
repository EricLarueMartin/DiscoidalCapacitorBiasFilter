# Simulations

The first simulations should be electrostatic and axisymmetric.

Primary questions:

- What peak electric fields appear at rounded plate edges?
- How sensitive are fields to edge radius and plate gap?
- How much capacitance is produced per discoidal gap?
- How should dielectric boundaries be placed near the end of plate overlap?
- What changes when the outer ground tube is present?

## Current Script Path

The first repository-native model is `software/bias_filter/axisymmetric_model.py`.

It can export geometry and run a compact r-z finite-difference electrostatic solve:

```powershell
python software/bias_filter/axisymmetric_model.py export
python software/bias_filter/axisymmetric_model.py solve
python software/bias_filter/axisymmetric_model.py cad
```

Generated summaries and SVGs are written to `simulations/axisymmetric/outputs/`.
CAD and mesh exports are written to `hardware/geometry/generated/`.

This model treats the central ferrite/resistive core as a conductive HV body for electrostatic field screening. The free dielectric from the core surface to the ground-plate inner radius is epoxy/fill. Washer material is present only as flat annular slabs in the axial gaps between adjacent plate faces. Rounded-edge pockets, tube-side fill, and other non-washer voids are epoxy. Flow holes in the HV plates are omitted from the axisymmetric model and should be checked later with a local 3D study if their dimensions approach high-field regions.

The peak-field search is a global scan over all dielectric grid nodes after solving the potential, not a single-start local optimizer. To reduce the chance that a narrow peak is missed before adaptive refinement, the grid is seeded in three deterministic ways before the probe solve: rounded conductor-edge neighborhoods, dielectric-side points radially away from the HV outer and ground inner plate edges, and washer-region points centered between adjacent plate faces. The later high-field adaptive pass then adds extra coordinates around all dielectric nodes above the configured field threshold.

The current peak is a screening metric. The UI reports `Supported Emax`, based on a same-material local neighborhood, and keeps the raw point maximum as a diagnostic. It includes a near-conductor sliver guard to avoid obvious nonconformal-grid spikes, but mesh sweeps still show that the maximum near rounded conductors can move between edge features. Treat supported and raw peaks as warning indicators and use them for relative comparisons only.

The default washer-overlap field remains the first sanity check for every solver path: with 6 kV across 1 mm, samples away from edges should be about 6.0 kV/mm. This check is now documented because it caught an early FEniCSx boundary-tagging failure. After the 2026-06-25 tolerance fix, both FD and deployed FEniCSx return about 6000 V/mm in the default flat washer gaps.

Field-map colors in the web app use one absolute `V/mm` scale. Dielectric breakdown values may appear as reference ticks and margin readouts, but they should not normalize individual pixels when the colorbar is labeled in kV/mm.

## RF Model Roadmap

The current frequency-response plot is a lumped RC ladder with a parasitic capacitance branch. It is useful for intuition and parameter sweeps, but it is not a field-based RF calculation.

The next field-based comparison should probably be a frequency-domain quasi-static admittance solve before a full-wave model. That solve would use the same axisymmetric geometry and complex material coefficient:

```text
div((sigma + j omega epsilon) grad(V)) = 0
```

This captures dielectric permittivity, dielectric loss if added, finite conductor conductivity, and frequency-dependent current paths while staying close to the existing electrostatic formulation. The web parameters now include plate and tube material names, conductivity `sigma`, relative permeability `mu_r`, and a comparison frequency; defaults use copper for both plates and tube.

A full-wave RF model is a separate tier. FEniCSx-style FEM can represent Maxwell problems with suitable vector/edge elements, but a useful implementation also needs port definitions, radiation or absorbing boundaries/PML where appropriate, conductor loss treatment, and validation against the simpler admittance and lumped RC models. For this filter size and the likely noise frequencies of interest, use the quasi-static admittance backend as the first repository-native RF target.
