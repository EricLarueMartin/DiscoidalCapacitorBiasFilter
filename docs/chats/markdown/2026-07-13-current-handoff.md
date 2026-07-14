# Current Handoff: 2026-07-14

## Project Rename

The project and GitHub repository are now named **Discoidal Capacitor Bias
Filter** and `EricLarueMartin/DiscoidalCapacitorBiasFilter`. The name describes
the geometry being analyzed. A later implementation is expected to serve SHV
connector inputs, but connector packaging is not part of the current analysis.
Active documentation, setup guides, web titles, generated identifiers, and
deployment defaults use the new name. Historical raw collaboration records
retain their original wording.

## Start Here

Continue from the latest `main` branch on `origin`. Read the root `AGENT.md`,
then the nearest directory-specific `AGENT.md` before editing. The current
design state is distributed across the files linked below; this note is an
orientation and open-issues map, not a replacement for the calculation notes.

The project was developed in a local Windows workspace and deployed to a
dedicated Raspberry Pi 5. Deployment hostnames, SSH keys, and absolute Pi paths
are intentionally not committed. Restore or inspect those from the lab
computer's ignored `.secrets/` notes, or follow `deploy/pi/agent-setup.md` to
discover/recreate them. Git is the durable handoff between computers.

## Current Design Direction

The mechanical stack is shared by two candidate resistance implementations:

- Stock alumina washers, copper bias/ground plates, and a copper ground tube.
- Ferrite-core option: machinable discs can provide useful bulk resistance,
  but the polycrystalline conduction path may introduce unacceptable 1/f noise.
- MELF option: specified thin-film resistors are the lower-noise choice, but
  available 12 Mohm parts and alumina's modest capacitance give weak 50/60 Hz
  attenuation in the current loaded ladder.

Neither option is selected or qualified. The presentation now tells the main
story in this order: physical/electrical model, simulation method,
simulation-derived results, two proposed prototypes, construction, then backup
validation slides.

The two core options slide also records a conditional hybrid worth evaluating
after ferrite excess-noise measurements: ferrite stages first for stronger
50/60 Hz attenuation, followed by MELF stages near the detector for lower
resistor noise.

## Promoted Default Geometry and Circuit

The canonical defaults are `hardware/geometry/default-parameters.json` and the
matching `DEFAULTS` object in `presentations/web/app.js`.

- Bias: 6 kV; detector/load current: 1 nA.
- Core: MMB 0207 MELF surrogate, 2.2 mm OD, direct 12 Mohm per stage.
- Core OD defaults to package-derived mode when a selected component has a
  known package diameter: 1.4 mm for MELF 0204 and 2.2 mm for MELF 0207. The
  Geometry tab checkbox can return the dimension to manual control. Materials
  without a package diameter always leave Core OD editable. Imports from older
  settings files retain an explicitly saved manual Core OD.
- Input end resistance: one stage resistance; output resistance: 50 ohm.
- Cable/load: 10 m, 50 ohm, velocity factor 0.66; detector capacitance 10 pF.
- Tube ID / ground OD: 26 mm.
- Washer: alumina, 6.6 mm ID, 20.0 mm OD, 1.5 mm thick, epsilon-r 10.
- Bias and ground plates: 1.5 mm thick copper, edge diameter 100% of plate
  thickness (0.75 mm radius).
- Washer relations use the flat-edge modes. They derive 5.1 mm ground-plate ID
  and 21.5 mm bias-plate OD, placing the washer edge at the start of each
  conductor's curved section.
- Derived radial gaps are 1.45 mm core-to-ground and 2.25 mm bias-to-tube.
- Two bias plate pairs by default.
- The repeating-interior FEA approximation is enabled by default.

Engineering text inputs accept optional spaces and the prefixes `T`, `G`, `M`,
`k`, `m`, `u`, `n`, `p`, and `f`; uppercase `M` means mega. Plate-thickness
controls extend down to 0.0175 mm (nominal half-ounce copper), but edge-field
results at that scale require much finer convergence work.

## Field Solver State

The browser and Python finite-difference solvers remain fast screening tools.
The Pi FEniCSx path uses a conforming axisymmetric Gmsh/DOLFINx dielectric mesh
and the cylindrical weak form. Peak electric field at rounded edges is not yet
qualified: use the supported peak for trends and retain the raw point maximum
for diagnostics until a real mesh-convergence loop is implemented.

The exact full-stack mirror plane is retained as `mirror_half`. Routine FEniCSx
screening defaults to `end_repeat_approx`:

1. Solve the physical end through the center of the first bias plate.
2. Solve from that bias-plate center through the center of the next ground
   plate.
3. Reconstruct the remaining interior by alternating copies and mirrors;
   mirror the end region at the far end.

This repeat construction is an approximation for the electric-field problem,
not an exact finite-stack symmetry. One-pair geometry falls back to exact
`mirror_half`.

The adjacent-bias parasitic-capacitance solve is different. Only the middle
bias plate is driven while neighboring bias plates are held at zero, so it has
the middle-plane mirror symmetry but not the repeating electric-field symmetry.
In approximate mode its domain is truncated at the neighboring bias center and
the exposed outer annulus on that cut is grounded. The result is still a
three-bias energy-polarization sanity check, not a full capacitance matrix.

## Electrical Model and Presentation

Use the full unbuffered RC ladder or backend MNA/SPICE result for design
conclusions. Do not multiply a one-section attenuation by section count:
downstream capacitors load upstream nodes, while cable, detector, and load
conductance occur only once at the output.

The main electrical-model slide maps `Rstage`, `Cg = 2 Cgap`, `Cpar`, the end
resistances, and the one-time output load. Its curve is explicitly one isolated
section for explanation only. Multiplied-section curves were removed from the
main loaded-ladder and SPICE plots. The divergence comparison remains as the
first backup circuit-model slide.

The slide formerly titled `SPICE Checks the Loaded-System Trend` is now
`SPICE Simulation on RC Ladder`. It compares the full ladder with its coax and
detector load against a full-ladder unloaded solve. The unloaded topology has
no load current, output-series current, cable, transmission line, or detector
capacitance and measures the last filter node at infinite input impedance. The
default 50 Hz results are about 18.16 dB loaded and 0.45 dB unloaded. The
preceding MELF + alumina slide is text-only so it does not show a live graphic
that may reflect different currently selected materials.

The web presentation includes dark mode, subscripted technical notation,
separate total-capacitance and parasitic-capacitance explanations, the repeat
cell sidebar explanation, two prototype concepts, and a thermal-risk slide.
The peak-field result slide is titled `FEA for Peak Electric Field`; avoid the
ambiguous phrase `design screen` there. Its remaining qualification caveat is
specific: the peak must converge under mesh refinement before it is used as a
breakdown limit.

## Alumina and Partial-Discharge Concern

This is a DC detector-bias filter, so insulation acceptance is not limited to
catastrophic breakdown. A small discharge in an epoxy void, crack, or
delaminated ceramic interface can inject a current pulse that appears as
detector noise or a false event. Under DC, wall charge may extinguish a pulse
temporarily; leakage, dielectric relaxation, ripple, or ionization can restore
the local field and allow intermittent recurrence.

Do not use alumina purity alone as a partial-discharge proxy. Representative
Vishay substrate data list 96% alumina at epsilon-r 9.6 and 19 kV/mm versus
99.5--99.6% at epsilon-r 9.8--9.9 and 23 kV/mm. The capacitance difference is
small and both bulk strengths exceed the nominal average washer field. The
potential practical advantage of a higher-purity grade is the associated
density, resistivity, and surface finish, but those properties should be
specified directly. A dense, lapped 96% washer with complete epoxy wetting is
preferable to nominally purer alumina with trapped air or a weak bond.

Source: https://www.vishay.com/docs/48666/_ms12821832-2306_design-guidelines_ultrasource_reduced-file-size.pdf

Prototype process and acceptance work should emphasize drying and cleaning the
ceramic, low-void filling, vacuum degassing/impregnation where practical,
cure-shrinkage and thermal-cycle adhesion, and a sensitive DC partial-discharge
or current-pulse test. Product comparisons should request open porosity, water
absorption, surface finish, dielectric-strength test method, and edge quality
in addition to alumina percentage.

## Thermal-Mismatch Analysis

The web app now retains the closed-form differential-contraction calculation
as an independent baseline and adds a separate axisymmetric thermoelastic
FEniCSx solve. `software/bias_filter/thermal_stress.py` and
`simulations/thermal/outputs/default-thermal-stress.json` contain the baseline;
`software/bias_filter/thermal_fenicsx_solver.py` implements the bonded-solid
FEA and is exposed as `POST /api/thermal-solve`.

For the default design at 20 C, the baseline is 15.2 MPa. The 0.30 mm FEA mesh
reports 32.175 MPa epoxy maximum-principal tensile P99 and a 53.254 MPa raw
corner peak. A 0.20 mm mesh reports 32.115 MPa P99 and 61.985 MPa raw peak.
The P99 comparison changes by 0.19%; the raw corner peak remains deliberately
identified as mesh-sensitive.

The FEA uses exact cylindrical and axial center-plane symmetry, perfect bonds,
traction-free exposed surfaces, linear elasticity, and a 70 C stress-free
reference. It excludes cure shrinkage, viscoelastic relaxation, voids,
cohesive interfaces, and debonding. It is a geometry-aware elastic comparison,
not an adhesive-fracture prediction. The 2--4 GPa epoxy modulus uncertainty
remains because MG Chemicals does not publish the 9510 modulus.

The Designer viewer now has four tabs: `CAD mesh`, `FEA model regions`,
`Electric field`, and `Thermal FEA`. The renamed FEA-regions view represents
the r-z materials used by the cylindrical solves rather than claiming to be a
literal half-section. The thermal tab maps epoxy maximum-principal tensile
stress, mirrors the exact solved half-stack for display, uses P99 as the color
scale maximum, and marks the raw corner peak separately. The default response
contains 2,362 epoxy cell-center samples and is about 75 kB.

The complete analytical derivation and numerical substitution are recorded in
`docs/knowledge/thermal-stress.md`. In brief, the baseline uses equibiaxial
plane stress, for which `epsilon = sigma (1 - nu) / E`, and sets this equal to
`k delta_alpha delta_T`. For the default alumina interface at 20 C,
`delta_alpha = 65.8e-6 /C`, `delta_T = 50 C`, and the mismatch strain is
0.00329. With `E = 3000 MPa`, `nu = 0.35`, and `k = 1`, the result is
15.1846 MPa. Solving the same expression at 20 MPa gives the +4.1439 C
closed-form strength crossing.

The current presentation has no claimed cold target. It shows a conservative
fully restrained risk onset and recommends controlled room-temperature
transport until representative bonded coupons establish a qualified limit.

### Priority follow-up: the published 3.9% shrinkage entry

Do not silently carry the existing interpretation forward. The exact source is
the official **MG Chemicals 9510 Technical Data Sheet**, version 5.2,
23 January 2026, page 2, in the **Liquid Properties** table. The row reads:

```text
Shrinkage    3.9%    Calculated
```

Source: https://mgchemicals.com/downloads/tds/tds-9510.pdf

Important provenance and limits:

- The TDS supplies the number and labels its method only as `Calculated`.
- It does not state in that row whether 3.9% is linear, volumetric, mass-based,
  cure-only, or measured from a particular gel/reference state.
- The same page separately lists liquid density as 1.1 g/mL and cured density
  as 1.2 g/mL. Do not reverse-engineer the 3.9% from those rounded densities
  without confirmation from MG Chemicals.
- Page 3 separately lists `Weight Loss @ 155 C (600 hrs) 3.9%`. That is a
  different property that happens to have the same numeric value; do not
  confuse it with the page-2 shrinkage row.
- Existing project text sometimes expands the row to “calculated cure
  shrinkage” or “liquid-to-cured shrinkage.” Those are project interpretations,
  not wording supplied by the TDS.
- The current thermal model records `cure_shrinkage_percent = 3.9` for
  provenance but does not add 3.9% as locked-in elastic strain. The locked-in
  fraction after gel, restraint during cure, stress relaxation near/above Tg,
  and local free-edge relief are unknown.

Future work should investigate this before relying on the thermal-risk
conclusion: determine exactly how MG defines/calculates the value, whether a
more detailed application guide or technical-support response exists, and how
much post-gel shrinkage can become residual stress in this geometry. This
handoff intentionally does not propose or implement a mitigation.

## Highest-Priority Open Work

1. Resolve the 9510 shrinkage definition and its relevance to locked-in cure
   stress; then revise the thermal model and slide if warranted.
2. Implement and record FEniCSx edge-mesh convergence before treating peak
   fields as breakdown acceptance values.
3. Replace the adjacent-bias energy-difference check with a capacitance-matrix
   charge extraction if quantitative Cpar accuracy becomes important.
4. Build representative copper/9510/alumina bonded-ring coupons using the real
   cure fixture and process; inspect and thermal-cycle them before assigning a
   cold transport or operating rating.
5. Develop a DC partial-discharge/current-pulse acceptance test for potted
   coupons and completed assemblies; evaluate voids and interface delamination,
   not only bulk dielectric breakdown.
6. Measure ferrite excess noise and MELF-stage parasitic capacitance/loaded
   response before selecting a prototype core.

## Validation and Continuation Commands

From the repository root:

```powershell
python -m unittest discover -s software/bias_filter -p "test_*.py"
python software/bias_filter/thermal_stress.py
```

Use the bundled Node executable or a system Node installation to syntax-check:

```powershell
node --check presentations/web/app.js
```

For deployment, follow `deploy/pi/agent-setup.md`; verify the backend health
endpoint and visually inspect the Designer and Slides tabs after copying the
web assets. Avoid treating a Pi-only checkout or microSD result as the durable
source of truth.

## Key Files

- `hardware/geometry/default-parameters.json`
- `docs/knowledge/geometry.md`
- `docs/knowledge/materials.md`
- `docs/knowledge/fenicsx-fea.md`
- `docs/knowledge/rc-network.md`
- `docs/knowledge/thermal-stress.md`
- `docs/knowledge/pi-fea-backend.md`
- `software/bias_filter/field_backend.py`
- `software/bias_filter/fenicsx_solver.py`
- `software/bias_filter/thermal_stress.py`
- `software/bias_filter/thermal_fenicsx_solver.py`
- `simulations/thermal/outputs/default-thermal-stress.json`
- `presentations/web/index.html`
- `presentations/web/app.js`
- `deploy/pi/agent-setup.md`

## Raw Collaboration Records for This Handoff

- `docs/chats/raw/2026-07-13-fenicsx-mirror-half-symmetry.txt`
- `docs/chats/raw/2026-07-13-fenicsx-repeating-cell-option.txt`
- `docs/chats/raw/2026-07-13-repeat-cell-sidebar-explanation.txt`
- `docs/chats/raw/2026-07-13-repeat-interior-default.txt`
- `docs/chats/raw/2026-07-13-cpar-fea-explanation-slide.txt`
- `docs/chats/raw/2026-07-13-slide-narrative-and-two-prototypes.txt`
- `docs/chats/raw/2026-07-13-default-design-thermal-stress.txt`
- `docs/chats/raw/2026-07-13-warm-transport-guidance.txt`
- `docs/chats/raw/2026-07-13-stage-multiplication-validation-slide.txt`
- `docs/chats/raw/2026-07-13-handoff-and-9510-shrinkage-source.txt`
- `docs/chats/raw/2026-07-13-package-core-alumina-and-fea-slide.txt`
