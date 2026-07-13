# Current Handoff: 2026-07-13

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

## Promoted Default Geometry and Circuit

The canonical defaults are `hardware/geometry/default-parameters.json` and the
matching `DEFAULTS` object in `presentations/web/app.js`.

- Bias: 6 kV; detector/load current: 1 nA.
- Core: MMB 0207 MELF surrogate, 2.2 mm OD, direct 12 Mohm per stage.
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

The web presentation includes dark mode, subscripted technical notation,
separate total-capacitance and parasitic-capacitance explanations, the repeat
cell sidebar explanation, two prototype concepts, and a thermal-risk slide.

## Thermal-Mismatch Screen

`software/bias_filter/thermal_stress.py` and
`simulations/thermal/outputs/default-thermal-stress.json` are the executable
calculation and saved result. The current closed-form model is deliberately a
screen, not an adhesive-fracture prediction. It uses an assumed 2--4 GPa epoxy
modulus range because MG Chemicals does not publish the 9510 modulus or the
needed copper/alumina interface-fracture properties.

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

The next chat should investigate this before relying on the thermal-risk
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
5. Measure ferrite excess noise and MELF-stage parasitic capacitance/loaded
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
