# Resistive Core Candidates

## Web Model Presets

The browser interface uses a generic `Core material` selector plus a separate `Direct stage RC inputs` checkbox. With the checkbox off, the app uses numeric sliders for effective relative permittivity and core volume resistivity, deriving total core resistance from volume resistivity and the current core geometry with `R = rho L / A`. With the checkbox on, the app uses direct `Stage R`; for MELF 0204/0207 presets it estimates capacitance from a geometric effective-core model rather than a fixed package `Cpar`. Non-MELF direct-stage models can still use the direct `Stage Cpar` input. These placeholders do not replace measured resistance, leakage, or noise data.

Current placeholders:

- Fair-Rite 61 NiZn: `epsr = 12`, `rho = 1e8 ohm-cm`.
- Generic NiZn ferrite: `epsr = 15`, `rho = 1e8 ohm-cm`.
- Vishay MMB0207 12 Mohm MELF: defaults to direct stage mode with `Stage R = 12 Mohm`, `core OD = 2.2 mm`, and geometric/effective-medium Cpar.
- MELF chain in MG 9510 epoxy: defaults to direct stage mode with `Stage R = 240 Mohm`, `Stage Cpar = 0.5 pF`.
- Conductive-epoxy-dominated core/contact region: `epsr = 4`, `rho = 1e-3 ohm-cm`.
- Custom: user-set `Conductor epsr` and volume resistivity.

## NiZn Ferrite

Possible first-prototype material because its volume resistivity may produce a total resistance near 100 Mohm in a compact cylindrical geometry.

### Fair-Rite Type 61 Candidate

Fair-Rite type 61 is the current first material to test. Fair-Rite lists it as a NiZn ferrite with initial permeability 125, Curie temperature greater than 300 C, and resistivity around 1e8 ohm-cm. At that nominal resistivity, millimeter-thick discs in the 4 mm to 6 mm diameter range land in an interesting resistance range for the central bias path, but the real value must be measured on the actual cut and polished samples.

Available first-test sample diameters:

- 4 mm.
- 5 mm.
- 6 mm.

Planned material preparation:

- Cut discs with a diamond saw.
- Polish or lap both faces to target thickness and parallelism.
- Inspect for chips, cracks, smeared conductive debris, and edge damage.
- Clean before resistance and contact tests.

Measurements to run before committing to this core strategy:

- Resistance versus disc thickness and area.
- Leakage current versus voltage and polarity.
- Noise under representative high-voltage low-current bias.
- Temperature coefficient and drift after thermal cycling.
- Surface leakage compared with bulk resistance.
- Contact resistance with the chosen conductive epoxy.
- Resistance and leakage before and after final epoxy potting and heat cure.

Unknowns:

- Noise under high-voltage low-current bias.
- Resistance uniformity and tolerance.
- Voltage and temperature coefficients.
- Surface leakage behavior.
- Compatibility with the dielectric stack and assembly process.
- Conductive-epoxy contact stability.
- Behavior after cutting, polishing, cleaning, potting, and heat cure.

## MELF Resistor Chain

Likely fallback if ferrite is noisy or insufficiently predictable.

### Vishay MMB 0207 As Per-Stage Core

Current concrete alternate: a 0207 MELF resistor in the 10 Mohm to 15 Mohm range, with the web default now set to the 12 Mohm value that was found in stock. The body is just under 6 mm long and about 2.2 mm diameter, with roughly 3.2 mm between metal end caps. That geometry looks compatible with a 1.5 mm thick plate plus washer stack if the resistor is soldered into the bias path instead of bonding ferrite discs with conductive epoxy.

For the current axisymmetric field-screening model, approximate this option as a `2.2 mm` diameter central core for geometry and local electric-field visualization. For the RC ladder model, the preset checks `Direct stage RC inputs` by default so the app uses direct stage resistance for one 0207 MELF per direct stage. Parasitic capacitance is modeled geometrically: the MELF body is treated as a ceramic substrate with an effective-permittivity correction for metal-film shielding,

```text
eps_eff = eps_substrate / (1 - film_fill_factor)
```

The current 0207 default is `eps_substrate = 9.8` and `film_fill_factor = 0.50`, so `eps_eff = 19.6`. This is an educated first-draft approximation for a high-value spiral-trimmed film resistor, not a substitute for direct impedance/parasitic measurement.

Advantages compared with ferrite discs:

- No need to cut ferrite discs.
- No need to epoxy ferrite to the bias discs; soldered terminations become possible.
- Thin-film MELF parts are specified, repeatable, and expected to be low noise, while ferrite noise remains suspect.

Possible issue:

- The spiral-trimmed metal film may create significant stray capacitance if it occupies much of the resistor body. The current model treats this as an effective-permittivity multiplier rather than trying to resolve the proprietary film path.

### Vishay MMB 0207 Candidate

Current candidate under consideration: Vishay Beyschlag professional thin-film MELF 0207 in the high-Mohm MMB 0207 family. Verify the exact orderable code before purchase, especially for the 12 Mohm stocked value now used by the web default.

Useful official limits from the 2026-01-20 Vishay MMB 0207 professional datasheet:

- Resistance range reaches 15 Mohm for MMB 0207, so 10 Mohm and possibly 15 Mohm values are in-family.
- 10 Mohm falls in the 50 ppm/K, 1% range; the tighter 25 ppm/K, 0.5% range only reaches 1 Mohm for MMB 0207.
- Rated operating voltage is 350 V AC RMS/DC per resistor.
- Rated dissipation is 1 W in power operation and 0.4 W in the standard low-drift operating mode, subject to film temperature.
- Body size is about 5.8 mm long by 2.2 mm diameter.

First-pass sizing correction:

- The `MMB0207 MELF` web preset is one 12 Mohm part per direct stage, with Cpar estimated from the effective ceramic/film body plus surrounding epoxy geometry.
- A 24-part / 240 Mohm chain remains a possible resistance scenario, but it is not the default single-MELF stage.
- Do not size the resistor count as if the full 6 kV detector-bias supply appears across the resistor string in normal operation. With sub-nA detector current, steady resistor drop is `I * R`.
- See `docs/knowledge/resistor-voltage-stress.md` before making resistor voltage-rating or resistor-count arguments.
- Pulse/surge robustness still matters for dielectric-breakdown faults, but the energy is set by the capacitance that discharges, usually pF-scale, not by a continuous full-bias resistor drop.
- The mechanical length of a simple end-to-end chain may still be noncompact; any chain build needs a routed geometry and a fresh parasitic-capacitance estimate.

Main design risks for the MELF-chain version:

- Local electric-field enhancement at resistor end caps, solder/conductive-epoxy joints, and any folded-chain turns.
- Distributed parasitic capacitance from the resistor string to ground and between bias nodes.
- Pulse/surge behavior for small capacitive discharge events.
- Potting-compound compatibility and long-term stability after heat cure.
- Surface leakage along resistor bodies, terminations, board/substrate surfaces, or epoxy interfaces.
- Assembly repeatability if the chain must fit inside the current washer/tube envelope.

Advantages:

- Better-specified resistance.
- Easier sourcing and repeatability.
- Clearer electrical model.

Concerns:

- More assembly complexity.
- Local field enhancement around discrete components.
- Parasitic capacitance along the resistor chain.
