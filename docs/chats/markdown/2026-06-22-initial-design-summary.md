# Initial Design Summary

Sources:

- `../raw/2026-06-22-initial-repo-seed.txt`
- `../raw/2026-06-23-web-materials-edge-rc-continuation.txt`
- `../raw/2026-06-23-pi-fea-backend-client-handling.txt`
- `../raw/2026-06-23-gap-parameterized-geometry-controls.txt`
- `../raw/2026-06-23-breakdown-based-spacing-ranges.txt`
- `../raw/2026-06-23-epoxy-material-and-epsilon-ui.txt`
- `../raw/2026-06-23-live-generated-slide-graphics.txt`
- `../raw/2026-06-23-radial-gap-label-clarification.txt`
- `../raw/2026-06-23-js-field-solver-commentary.txt`
- `../raw/2026-06-23-core-resistivity-derived-resistance.txt`
- `../raw/2026-06-23-pi-backend-scaffold.txt`
- `../raw/2026-06-23-dielectric-breakdown-margins.txt`
- `../raw/2026-06-23-conductive-core-field-region-correction.txt`
- `../raw/2026-06-23-default-plate-pairs-edge-diameter.txt`
- `../raw/2026-06-24-single-stage-rc-ladder-drawing.txt`
- `../raw/2026-06-24-analytic-radius-arrow-alignment.txt`
- `../raw/2026-06-24-rc-stage-capacitance-terminology.txt`
- `../raw/2026-06-24-default-m8x20x1-washer-geometry.txt`
- `../raw/2026-06-24-stage-resistance-length-correction.txt`
- `../raw/2026-06-25-melf-0207-resistor-chain-candidate.txt`
- `../raw/2026-06-25-melf-direct-stage-controls.txt`
- `../raw/2026-06-25-slide-simulation-result-source-and-breakdown-scale.txt`
- `../raw/2026-06-25-melf-default-merge-and-resistor-stress-correction.txt`

## Decisions

- Use a Git repository structured for AI collaboration.
- Include `AGENT.md` guidance at each directory level.
- Preserve raw chats and summarize them into hierarchical markdown knowledge.
- Include a web-based presentation section.
- Treat LEGEND-style SHV bias filtering as the initial use case while keeping the design adaptable.

## Core Design

The filter is an axisymmetric stack of alternating HV and ground plates. The HV path includes a large central resistance. The capacitive sections use dielectric-filled plate overlap regions, while non-overlap regions may use lower-permittivity material to reduce unwanted capacitance.

## Open Questions

- Is NiZn ferrite quiet and stable enough as a resistive core?
- What field enhancement occurs at the rounded inner and outer plate edges?
- Does the dielectric boundary need to intrude into the overlap region, or can it end at the overlap edge?
- How much does the outer ground tube change peak field and capacitance?
- What connector strategy is appropriate after the screw-terminal prototype?

## 2026-06-22 Edge-Effect Update

- Concern: capacitor plate edges may raise local electric field, but rounded or foil-like edges should scale more weakly than a needle point.
- Correction: the `1 - z / sqrt(R^2 + z^2)` disk-axis expression assumes uniform surface charge, while the filter plates are closer to constant-potential conductors.
- Working approximation: use the nearest opposite-conductor clearance, then evaluate both local conducting-cylinder-over-plane and equal-clearance surrounding-ground limits for web-interface screening; treat it as triage only.
- Interpretation: this is plausibly conservative because it replaces open fringe space with closer/larger grounded boundaries, but that is more like a capacitance or field-energy argument than a proven pointwise peak-field bound.
- Additional bound idea: a ball of radius equal to the edge radius inside an equal-clearance grounded sphere gives a very conservative analytic envelope; stretching that ball into a disk while maintaining or increasing ground distance should smear charge and reduce peak field.
- Web UI change: specify rounded edge by diameter as a percentage of plate thickness; derive radius internally for geometry and field estimates.
- FEA follow-up: start with analytic benchmark geometries including parallel plates, coaxial cylinders, cylinder over plane, cylinder inside a grounded shell, sphere inside a grounded shell, conducting disks, and rounded wedge/edge cases.
- Durable note: `docs/knowledge/edge-effects.md`.
- Follow-up: calibrate or replace the approximation with axisymmetric FEA when simulation work resumes.

## 2026-06-22 RC-Network Update

- Need: estimate the ladder stage formed by capacitance from each bias plate to ground and resistance between adjacent bias plates.
- Added web estimates for one-gap HV-ground capacitance, per-stage bias-node capacitance to the two adjacent ground plates, adjacent bias-to-bias parasitic capacitance, parasitic-to-stage-capacitance ratio, adjacent bias resistance, and RC corner frequency.
- Working approximation: use parallel-plate capacitance for washer overlap and for parasitic capacitance through the core material plus epoxy around the core inside the ground-plate inner diameter.
- High-frequency concern: `C_parasitic / C_g_stage` sets a capacitive feedthrough divider when the resistor no longer dominates.
- Durable note: `docs/knowledge/rc-network.md`.

## 2026-06-22 Material/Assembly Update

- Candidate washer dielectric: alumina is now the preferred Prototype 0 target because the RC corner is already comfortably below 50 Hz with obtainable geometry. FR4/G10 remains the fallback if alumina washers cannot be sourced or machined.
- Candidate potting compound: MG Chemicals 9510 One-Part Epoxy Potting Compound, Heat Cure.
- Candidate resistive core: Fair-Rite type 61 NiZn ferrite, first tested as 4 mm, 5 mm, and 6 mm diameter cut-and-polished discs.
- Candidate contact method: conductive epoxy between ferrite discs and bias plates, with spacers holding the stack geometry during bonding and potting.
- Candidate void-control process: fill with epoxy, then use repeated vacuum and nitrogen-pressure cycles before heat cure.
- Web UI changes: added a washer material preset menu and a `C vs FR4` metric. Alumina now uses `epsr = 10` as the default washer value, while FR4/G10 remains available at `epsr = 4.4`. Also corrected the core controls so they are generic `Core material` plus internal `Conductor epsr`, displayed as `Conductor &epsilon;<sub>r</sub>`, with Type 61 only one selectable preset.
- Piezoelectric or ferroelectric high-permittivity washer dielectrics are now screening-only / likely no-go because microphonics could couple into the detector-bias path.
- Alumina PD interpretation: dense alumina is a sensible low-PD-risk ceramic, but the likely discharge initiators are interface voids, epoxy bubbles, chipped washer edges, cracks, contamination, and sharp conductor features rather than the nominal alumina bulk alone.
- Key risks to measure: ferrite noise and voltage coefficient, surface leakage after cutting/polishing, conductive-epoxy contact resistance and squeeze-out, trapped voids or partial discharge, cure/shrinkage stress, and dielectric loss/leakage/microphonics for any non-alumina high-permittivity washer candidate.
- Durable notes: `docs/knowledge/materials.md`, `hardware/materials/resistive-core.md`, and `hardware/prototypes/prototype-0.md`.

## 2026-06-23 Raw-Record Update

- Added a reconstructed raw conversation record for the web/materials/edge/RC continuation.
- Important caveat: the raw continuation omits tool logs and routine intermediate steps, and some turns respond to partially finished browser/app work. Readers should expect some apparent non sequiturs.
- Instruction strengthened: future substantive sessions should update `docs/chats/raw/` before closing, even when work remains in progress.

## 2026-06-23 Pi FEA Backend Update

- The web app should keep live approximations and quick screening in browser JavaScript.
- The `Solve field` button is now shaped to try a future `/api/field-solve` backend first, then fall back to the local JavaScript finite-difference solver if no backend is present.
- Multi-client backend rule: the Pi server should use per-solve job IDs and per-job results, not shared `latest-*` output files, so separate tabs or users cannot overwrite or receive each other's solves.
- Durable note: `docs/knowledge/pi-fea-backend.md`.

## 2026-06-23 Gap-Control Update

- Web geometry controls now use radial gaps for dependent dimensions: core-to-ground gap and HV-to-tube gap.
- Ground plate outside diameter is derived as equal to tube inside diameter.
- Derived dimensions still populate the legacy parameter names used by the solver and CAD/field drawing code.
- Durable note: `docs/knowledge/geometry.md`.

## 2026-06-23 Breakdown-Range Update

- Clearance-like web controls now use provisional washer-material dielectric strength to set their slider minimum and 10x design-factor maximum.
- The affected controls are core-to-ground gap, HV-to-tube gap, plate gap, and plate thickness.
- Custom and generic high-K screening presets use a fixed `0.4 mm` to `4 mm` range.
- These ranges are early screening constraints only; real hardware needs datasheets, measured coupons, and interface/void/edge assessment.
- Durable notes: `docs/knowledge/materials.md` and `docs/knowledge/design-requirements.md`.

## 2026-06-23 Permittivity/Epoxy UI Update

- The visible web UI now displays relative permittivity as `&epsilon;<sub>r</sub>` instead of `epsr`.
- Internal field names keep the ASCII `epsr` suffix for JSON, JavaScript, Python, and future API compatibility.
- The epoxy region now has an `Epoxy material` dropdown. MG Chemicals 9510 is the selected first candidate, not the generic label for the whole epoxy control.

## 2026-06-23 Slide Graphics Update

- The Slides tab now uses live generated graphics from the current designer parameters.
- Added slide canvases for the CAD cutaway, r-z geometry half-section, material-region callouts, rounded-edge screening, and RC ladder estimates.
- The drawing functions were generalized so the same design state can render to both the designer canvases and the presentation canvases.

## 2026-06-23 Radial Gap Label Clarification

- Confirmed the core-ground and HV-tube gap controls are radial surface-to-surface clearances, not diameter deltas.
- The derived diameters use the expected factor of 2: ground ID equals core OD plus twice the core-ground gap, and HV OD equals tube ID minus twice the HV-tube gap.
- Updated the web labels to say radial for those clearances and axial for the plate gap.
- Fixed the 2D r-z geometry and field canvases to use an equal mm-to-pixel scale in the axial and radial directions, so equal axial/radial dimensions look equal on screen.

## 2026-06-23 JavaScript Solver Clarification

- Confirmed the current in-browser `solveField` path is a structured-grid finite-difference / finite-volume-style relaxation solver, not real FEA.
- The metric formerly labeled `Iterations` is now labeled `Solver sweeps`; for the JavaScript fallback it means full Gauss-Seidel relaxation passes over the structured r-z grid.
- Added detailed code comments explaining the grid construction, conductor sampling, boundary conditions, relaxation stencil, field extraction, and limitations.
- Fixed the JavaScript fallback sweep count so reaching the configured sweep limit reports the actual number of sweeps instead of one too many.
- The browser fallback grid is now locally refined around rounded plate-edge fillets. The injected corner coordinates keep local spacing no larger than one tenth of the physical rounded-edge radius while avoiding that spacing throughout the whole bulk volume.
- The browser fallback now also performs one field-driven adaptive refinement pass: a probe solve locates high-field dielectric nodes, midpoint coordinates are inserted around those regions, and the final solve is seeded from the probe voltage.

## 2026-06-23 Core Resistivity Update

- The web app now specifies core volume resistivity with a log-scale slider in ohm-cm instead of directly specifying total core resistance.
- Total core resistance is derived from `R = rho L / A` using the current stack length and core cross-sectional area.
- Adjacent bias-to-bias stage resistance is derived from the same resistivity and the HV-to-HV pitch.
- Fair-Rite type 61 and generic NiZn presets default to `1e8 ohm-cm`; the derived total core resistance remains as a readout and legacy parameter.

## 2026-06-23 Pi Backend Scaffold

- Added `software/bias_filter/field_backend.py`, a dependency-free Python HTTP server for the Pi.
- The server serves the web designer and implements `POST /api/field-solve`, `GET /api/field-solve/{job_id}`, and `GET /api/health`.
- Each solve request receives an independent job ID and writes under a per-job directory, avoiding shared `latest-*` browser outputs.
- The current backend worker uses the repository axisymmetric finite-difference screening solver and reports `source = fea-backend-axisymmetric-fd`; it is structured so a stronger FEA worker can replace that solve step later.
- Backend results now include a symmetry plan. Future FEA should generally use an exact mirrored half-stack solve, while `full_stack` remains the validation/browser-compatible fallback.
- The repeated-cell approximation was dropped from the backend plan. If a smaller representative calculation is desired, the user can set the web UI to two plate pairs explicitly.
- The mirror-half code path must be checked against a same-geometry full-stack solve before use. This is a code/regression check, not a physics approximation check.
- Future FEA should use adaptive meshing or explicit local refinement. Rounded plate edges, dielectric-boundary endpoints, and tube-facing high-field regions need much finer elements than the bulk, with mesh convergence recorded for peak field and peak location.

## 2026-06-23 Dielectric Margin Update

- The web field solve was extended to report maximum sampled electric field by dielectric region and show margin as `E_breakdown / E_max` where a selected material has a placeholder strength.
- Washer presets reuse the existing provisional dielectric-strength values; epoxy presets use a conservative placeholder of `15 kV/mm` until MG 9510/current datasheet or coupon values are entered.
- A follow-up correction removed the separate core-adjacent margin bucket because the central resistive/conductive path is an equipotential conductor for electrostatic field screening.

## 2026-06-23 Conductive-Core Field Region Correction

- Corrected the dielectric-margin interpretation: the actual core is conductive/resistive and is an equipotential HV body for electrostatic field screening.
- The core-to-ground free dielectric gap is epoxy/fill, so its peak field and breakdown margin now roll into the epoxy bucket.
- The web and Python screening solvers now use epoxy relative permittivity for solved dielectric nodes between the conductive core surface and the ground-plate inner radius.
- The UI no longer shows a separate core breakdown readout or core-adjacent dielectric margin.

## 2026-06-23 Default Geometry Update

- Default plate pairs changed from 3 to 2.
- Default edge diameter remains 100%, which corresponds to edge radius equal to half the plate thickness.
- Browser defaults, repository JSON defaults, backend fallback defaults, and the RC-network note were kept consistent.

## 2026-06-24 Single-Stage RC Drawing Update

- The slide RC ladder graphic now shows one stage only: two bias nodes, one series stage resistor, two shunt capacitances to ground, and one parasitic capacitance between the two bias nodes.
- Removed the visual continuation that previously showed a second resistor and third shunt capacitor.

## 2026-06-24 Analytic Radius Arrow Update

- Moved the analytic-check edge-radius double arrow onto the fillet-circle centerline so it runs from the circle center to the rim instead of floating above the radius.

## 2026-06-24 RC Stage Terminology Update

- Clarified that `Gap C` is one HV-ground physical gap, while `Stage Cg` is the capacitance from one bias plate to its two adjacent ground plates.
- The attenuation plot uses `Stage Cg = 2 * Gap C`, `Stage R`, and `Stage Cpar`.
- `Stage Cpar` is estimated from capacitance through the core material plus the epoxy around the core between adjacent bias plates.

## 2026-06-24 Default M8x20x1 Washer Geometry

- Updated defaults to match an easily sourced alumina M8x20x1 washer: 8.2 mm ID, 20 mm OD, 1 mm thickness.
- Kept the web inputs unchanged; the existing gap controls now default to core-ground radial gap 2.1 mm, HV-tube radial gap 2 mm, plate gap 1 mm, and tube ID 24 mm.
- The derived default geometry is ground ID 8.2 mm, HV OD 20 mm, and ground OD/tube ID 24 mm.

## 2026-06-24 Stage Resistance Correction

- Corrected `Stage R` to use the face-to-face adjacent-bias separation through gap + ground plate + gap.
- For the 1 mm gap / 1 mm plate default, the stage resistance length is 3 mm, not the 4 mm HV-center-to-HV-center pitch.
- The default `Stage R` is now about 239 Mohm for a 4 mm core OD and `1e8 ohm-cm` core resistivity.

## 2026-06-24 Current Corrections

This historical summary includes earlier intermediate defaults. The current design state is captured in `2026-06-24-current-handoff.md`; key corrections are:

- Default core OD is now 2 mm, not 4 mm.
- HV OD is the editable outer radial control with a 12 mm minimum. Tube ID and ground plate OD are derived from `HV OD + 2 * HV-tube radial gap`.
- Current default derived geometry is core OD 2 mm, ground ID 6.2 mm, HV OD 20 mm, and tube ID / ground OD 24 mm.
- The designer labels the axial gap as washer thickness and the conductor thickness as plate thickness.
- The web UI reports `Supported Emax` plus the raw point maximum diagnostic, rather than using a single raw point maximum as the headline result.
- FEniCSx is implemented and installed on the Pi, but the deployed service still defaults to FD for ordinary jobs. Use `FEniCSx required` for the conforming solver.
- Field solvers and cutaway views use flat washer slabs only between adjacent plate faces. Epoxy fills rounded-edge pockets and other non-washer voids. The capacitance estimate still uses the simpler washer-overlap approximation.

## 2026-06-25 MELF 0207 Resistor Chain Candidate

- A resistor-chain alternate is now under consideration using a Vishay Beyschlag professional MMB 0207 MELF part around 10 Mohm per resistor.
- The exact typed order code `MMB0207MC1005FB200` did not resolve directly; verify the part number before ordering. The official Vishay ordering grammar suggests a likely 10 Mohm, 50 ppm/K, 1%, B2-code part is close to `MMB02070C1005FB200`.
- Datasheet-screening limits: MMB 0207 reaches 15 Mohm, 10 Mohm is in the 50 ppm/K 1% range, rated operating voltage is 350 V AC RMS/DC per resistor, and body size is about 5.8 mm by 2.2 mm.
- The `MMB0207 10M MELF` web preset is one 10 Mohm direct stage with `Stage Cpar = 0.3 pF`. The 240 Mohm value is only a deliberate chain scenario or the potted MELF-chain preset.
- Important correction: do not size this resistor option as if full 6 kV DC appears across it in normal operation. The detector load is sub-nA, so resistor drop is `I * R`; see `docs/knowledge/resistor-voltage-stress.md`.
- This option should later be modeled as a physical resistor or routed discrete resistor chain because end caps, joints, folded turns, potting interfaces, pulse behavior, and distributed capacitance may dominate the field and parasitic behavior.

## 2026-06-25 MELF Direct Stage Controls

- The RC ladder method is now controlled by a separate `Direct stage RC inputs` checkbox rather than being permanently tied to MELF material selection.
- When direct stage mode is active, the web app shows direct `Direct stage R` and `Direct stage Cpar` controls while hiding the bulk resistivity and conductor-epsilon controls.
- Ferrite-like presets still derive `Stage R` from `rho L/A` and `Stage Cpar` from the simple core-plus-epoxy parallel-plate approximation.
- Selecting a MELF preset checks direct stage mode by default. The default MMB0207 MELF stage is `10 Mohm` and `0.3 pF`; the potted MELF-chain preset uses `240 Mohm` and `0.5 pF`.

## 2026-06-25 Slide Simulation Result Source And Breakdown Scale

- The Slides tab Simulation Results graphic now uses the latest actual solved field result when it matches the current design parameters.
- If no matching solve exists after parameter changes, the slide falls back to a reduced browser JS preview and labels that explicitly.
- The slide includes a source blurb identifying whether it is showing Browser JS, backend adaptive FD, backend FEniCSx, or preview output.
- Field-map colors now normalize dielectric cells by their material breakdown value where available, giving washer and epoxy separate breakdown-relative color behavior.
- The colorbar maximum is the highest available dielectric breakdown field and includes marker lines for the dielectric breakdown values, including the lower-breakdown material.

## 2026-06-25 MELF Default Merge And Resistor Stress Correction

- Merged the other chat's MELF default: the `MMB0207 10M MELF` direct stage uses `10 Mohm` and `0.3 pF`, while the potted MELF-chain preset remains `240 Mohm` and `0.5 pF`.
- Aligned the default JSON and backend fallback to `melf_stage_resistance_log10_ohm = 7.0`.
- Added `docs/knowledge/resistor-voltage-stress.md` and a root `AGENT.md` guardrail.
- Key correction: do not size the MELF resistor path as if it must hold the full 6 kV DC bias in normal operation. The steady drop is `I * R` at sub-nA detector current; full-bias breakdown is a dielectric/spacing and capacitive pulse-energy issue.
