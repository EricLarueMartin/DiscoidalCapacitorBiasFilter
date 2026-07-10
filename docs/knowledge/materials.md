# Materials Notes

## Current Candidate Stack

Status: candidate stack for Prototype 0, not yet validated by high-voltage testing.

- Washer dielectric: alumina is the preferred Prototype 0 target because the current RC estimates are already below 50 Hz with obtainable geometry, and dense alumina is a conservative high-voltage ceramic choice. FR4/G10 remains the practical fallback if suitable alumina washers cannot be sourced. Piezoelectric or ferroelectric high-permittivity ceramics are screening-only because microphonics, voltage coefficient, loss, and temperature dependence are likely unacceptable.
- Potting and fill: MG Chemicals 9510 One-Part Epoxy Potting Compound, Heat Cure. MG's SDS/TDS database lists 9510 as a one-part epoxy potting compound in liquid format. Pull the dielectric constant, dielectric strength, volume resistivity, cure schedule, shrinkage, and thermal limits from the current TDS before freezing model defaults.
- Resistive core / conductor path: Fair-Rite type 61 NiZn ferrite is the first concrete sample set, but the web model should keep this generic as a core/conductor material. Fair-Rite lists type 61 as NiZn with initial permeability 125, Curie temperature greater than 300 C, and resistivity around 1e8 ohm-cm. Treat this as a sizing estimate until the actual 4 mm, 5 mm, and 6 mm diameter samples are cut, polished, contacted, and measured.
- Ferrite-to-plate contact: conductive epoxy between ferrite discs and bias plates. Exact product is TBD; verify contact resistance, cure compatibility, squeeze-out control, HV behavior, outgassing, and long-term stability.
- Mechanical positioning: temporary or permanent spacers to hold the plate, ferrite-disc, and washer stack aligned during conductive-epoxy cure and final potting.

## Assembly Process Candidate

- Cut the NiZn ferrite samples into discs with a diamond saw.
- Lap or polish the disc faces to controlled thickness and parallelism.
- Clean and inspect ferrite surfaces before bonding; record any chipped edges, cracks, or conductive debris.
- Assemble bias plates, ground plates, alumina washers, ferrite discs, spacers, and conductive-epoxy joints in the parameterized prototype fixture.
- Fill with MG Chemicals 9510 epoxy after the conductive joints and mechanical spacers hold the stack position.
- Vacuum degas aggressively, using repeated vacuum and nitrogen-pressure cycles if available, to reduce voids that could seed partial discharge.
- Cure using the vendor TDS schedule; record time, temperature, ramp rate, fixture constraint, and post-cure inspection.

## Resistive Core

The desired central resistance is approximately 100 Mohm to low Gohm. The first prototype may use NiZn ferrite if its volume resistivity gives the target resistance at reasonable dimensions.

The web model separates the core controls:

- `Core material`: preset selector for the material under consideration.
- `Core volume resistivity`: log-scale input in ohm-cm. The app derives total core resistance from this value and the current core length and cross-sectional area.
- `Conductor epsr`: internal parameter name for effective relative permittivity, displayed in the UI as `Conductor &epsilon;<sub>r</sub>`.
- `Core R total`: derived readout kept for sizing and legacy parameter compatibility.

The `Conductor epsr` value is a rough circuit/parasitic modeling parameter, not a field-stress dielectric limit. For electrostatic field screening, the conductive core is an equipotential HV body; the solved dielectric immediately outside that core is epoxy/fill.

Current web presets:

| Preset | Circuit controls | Geometry/field placeholder | Use |
| --- | --- | --- | --- |
| Fair-Rite 61 NiZn | `epsr = 12`, `rho = 1e8 ohm-cm` | Conductive core OD from geometry | First physical ferrite sample set. |
| NiZn ferrite | `epsr = 15`, `rho = 1e8 ohm-cm` | Conductive core OD from geometry | Generic NiZn sensitivity check. |
| MMB0207 MELF | Defaults to direct `Stage R = 12 Mohm`; Cpar from effective ceramic/film geometry | 2.2 mm axial core surrogate | Single 0207 MELF modeled as a discrete direct stage by default. |
| MELF chain in 9510 | Defaults to direct `Stage R = 240 Mohm`, `Stage Cpar = 0.5 pF` | Conductive core OD from geometry | Epoxy-potted discrete resistor-chain approximation by default. |
| Conductive epoxy | `epsr = 4`, `rho = 1e-3 ohm-cm` | Conductive core OD from geometry | Placeholder for a conductive-epoxy-dominated core/contact region. |

Risks to investigate:

- Excess electrical noise.
- Voltage coefficient of resistance.
- Temperature dependence.
- Long-term stability.
- Surface leakage compared with bulk resistance.
- Compatibility with dielectric and mechanical assembly materials.
- Contact resistance and contact stability through the conductive-epoxy joints.
- Changes after cutting, polishing, cleaning, potting, and heat cure.

## Alternate Resistance Strategy

A chain of high-value MELF resistors may be preferable if ferrite performance is noisy, unstable, or difficult to control. This option may reduce uncertainty at the cost of more assembly complexity and possible parasitic structure.

A second MELF option is to use a single 0207 resistor as the per-stage axial element rather than a ferrite core segment. The package is just under 6 mm long by about 2.2 mm diameter, with approximately 3.2 mm between the metal end caps. A 1.5 mm thick plate and washer stack may therefore be mechanically plausible, and soldered end-cap joints could replace the ferrite-disc cutting, lapping, and conductive-epoxy bonding steps. In the web model, this is represented by the `MMB0207 MELF` preset with `core OD = 2.2 mm` for geometry/field visualization. Selecting the MELF preset checks `Direct stage RC inputs` by default, exposing direct per-stage resistance while modeling Cpar from the ceramic body and surrounding epoxy.

The main benefit is a specified low-noise resistor technology instead of a ferrite body whose bias-noise behavior is uncertain. The main risk is stray capacitance from the spiral-trimmed metal-film structure and end-cap geometry. The current first-draft model uses `eps_eff = eps_substrate / (1 - film_fill_factor)`, defaulting to alumina-like `eps_substrate = 9.8` and `film_fill_factor = 0.50` for 0207. This needs either a geometry-specific measurement or a better package model before final design.

Current MELF-chain candidate: Vishay Beyschlag MMB 0207 professional thin-film MELF, now using 12 Mohm as the default per-stage value because that value was found in stock. Verify the exact orderable code before purchase.

Important correction: do not size this resistor option as if the full 6 kV DC detector bias appears across the MELF resistor in normal operation. The detector load is below 1 nA, so the steady resistor drop is approximately `I * R`, not the full supply voltage. Use `docs/knowledge/resistor-voltage-stress.md` before making resistor voltage-rating or resistor-count arguments. Pulse/surge robustness may still matter if a dielectric breakdown dumps stored capacitance, but that is a pF-scale capacitive-energy question rather than a steady 6 kV-per-string requirement.

The MELF option should still be modeled as a physical resistor body or routed resistor chain, not as a perfectly uniform conductive cylinder, once the intended routing is known. Main risks are local field enhancement at resistor terminations and joints, parasitic capacitance to ground and across the stage, surface leakage after potting, pulse/surge response, and long-term compatibility with heat-cured epoxy.

## Dielectric Selection

The design likely benefits from more than one dielectric:

- High permittivity in the HV-to-ground overlap region for capacitance.
- Low permittivity near the resistive core to reduce parasitic capacitance.
- Possibly low permittivity outside the plate overlap to manage fringe fields.

Candidate materials should be tracked with permittivity, dielectric strength, loss tangent, volume resistivity, machinability, outgassing, radiopurity if relevant, and availability.

In code and JSON, the suffix `epsr` means relative permittivity, `epsilon_r`. The web UI should display this as `&epsilon;<sub>r</sub>` where possible.

## Washer Dielectric Options

Approximate capacitance improvement in the web model scales linearly with washer `epsr`, because the first-pass estimate is a parallel-plate capacitance through the washer overlap region. The app now defaults to alumina (`epsr = 10`) and reports `C vs FR4` using FR4/G10 as `epsr = 4.4`.

The web interface uses provisional dielectric-strength values to set minimum clearances. It rounds the minimum upward from `bias_voltage / dielectric_strength`. The core-to-ground radial gap uses the epoxy/fill breakdown value for that minimum because epoxy occupies that region; its maximum comes from the available geometry while preserving the minimum radial overlap between the ground and HV plates, with the backend's 50 mm limit as the final ceiling. Washer-controlled axial ranges retain the 10-times-minimum screening range. Custom and generic high-K screening presets use a `0.4 mm` fallback minimum until a real material is selected. After a field solve, the web interface reports the neighborhood-supported electric field in the washer and epoxy/fill regions and displays `E_breakdown / E_max` as a first-pass design margin where a placeholder breakdown strength is available. The raw point maximum remains available as a mesh-artifact diagnostic. The epoxy/fill bucket includes the core-to-ground dielectric gap around the conductive core and the rounded-edge pockets outside the flat washer slabs.

These values are not qualification limits. Actual breakdown depends on thickness, electrode geometry, surface finish, humidity, voids, interfaces, defects, and test protocol.

| Candidate | Web epsr placeholder | Web dielectric-strength placeholder | Capacitance vs FR4 | Practical read |
| --- | ---: | ---: | ---: | --- |
| FR4/G10 | 4.4 | 20 kV/mm | 1.0x | Practical fallback if alumina washers are unavailable. Easy to mill, drill, and iterate. Check HV leakage after machining and cleaning. |
| Macor or similar machinable glass ceramic | 6 | 40 kV/mm | 1.4x | More ceramic-like and machinable with ordinary shop tooling, but not a high-permittivity win. Useful if FR4 outgassing or moisture is a concern. |
| Alumina | 10 | 13 kV/mm | 2.3x | Preferred washer target. Good electrical/mechanical baseline, non-piezoelectric, and likely lower PD risk than polymer washers when dense, clean, uncracked, and well bonded. Prefer purchased washers or vendor grinding/laser/waterjet service. |
| Zirconia or ZTA | 25 | 10 kV/mm | 5.7x | Potentially higher permittivity than alumina and mechanically tough, but verify dielectric strength, loss, resistivity, and availability in washer geometry. |
| BaTiO3 / PZT class electroceramic | 100 placeholder | custom range | 22.7x placeholder | Screening-only / likely no-go. Electrically attractive, but ferroelectric or piezoelectric behavior can create microphonics, voltage coefficient, dielectric loss, and temperature sensitivity. |
| SrTiO3 or other non-piezo high-K ceramic | 100 placeholder | custom range | 22.7x placeholder | Screening-only. Avoid unless an actual washer or coupon has low loss, low leakage, low voltage coefficient, and no measurable microphonic response. |

Sourcing strategy:

- For the first build, search for stock alumina insulating washers first; if the dimensions are not available, ask a technical ceramics shop for laser-cut, waterjet-cut, diamond-ground, or fired-to-shape alumina washers.
- If alumina sourcing stalls, cut FR4/G10 washers from laminate sheet or buy Garolite/FR4 insulating washers if the dimensions are close enough.
- For a higher-permittivity structural ceramic, ask custom ceramics vendors about zirconia or ZTA washers and request dielectric-property data at the relevant field, frequency, and temperature.
- Avoid piezoelectric high-K rings for the main dielectric path unless a coupon test proves microphonics are negligible. If high-K is revisited, prefer non-piezo candidates and treat all of them as test coupons rather than final dielectric washers.
- Test at least one washer coupon by measuring capacitance, leakage versus voltage, dissipation factor if possible, and microphonic response before embedding it in potted hardware.

## Epoxy Fill Options

The epoxy fill should be a selectable material in the web model. MG Chemicals 9510 is the first concrete option under consideration, not the generic name of the epoxy region.

Current web presets:

| Preset | Web epsr placeholder | Web dielectric-strength placeholder | Use |
| --- | ---: | ---: | --- |
| MG Chemicals 9510 | 3.4 | 15 kV/mm | First potting-fill candidate. Confirm with current TDS before freezing the value. |
| Generic potting epoxy | 3.2 | 15 kV/mm | Sensitivity placeholder for ordinary epoxy potting compounds. |
| Low-k epoxy | 2.8 | 15 kV/mm | Sensitivity placeholder for lower-permittivity fill choices. |
| Custom | user-set | unset | Manual value for datasheet or measured candidates. |

## Alumina And Partial Discharge Notes

Alumina is not automatically void-free, but dense technical alumina is a strong candidate for low partial-discharge risk because it is a hard, inorganic, non-piezoelectric electrical insulator with stable permittivity near the target range. The likely PD initiators in this assembly are not bulk alumina pores first; they are gas voids, cracks, chipped washer edges, rough or contaminated surfaces, trapped bubbles in potting epoxy, and conductor/dielectric interface gaps.

Working interpretation:

- Dense purchased alumina washers are preferred over hand-machined ceramic when possible.
- Surface finish, edge chips, washer flatness, and trapped interface bubbles may dominate over nominal bulk material choice.
- Vacuum/pressure cycling of the potting epoxy is still important because voids in epoxy or at interfaces can seed partial discharge even if the washer body is dense.
- Visual inspection under magnification and a stepped HV/PD/leakage test should be part of washer qualification.

## Material and Process Risks

- Conductive epoxy squeeze-out could create local field enhancement, leakage paths, or bias-to-ground shorts.
- Voids in the potting compound could seed partial discharge, especially near conductor edges and ferrite/epoxy interfaces.
- Ferrite cutting and polishing may change surface leakage enough that bulk-resistivity estimates are misleading.
- Epoxy shrinkage and cure stress could crack ferrite or alumina, open conductive joints, or warp the plate stack.
- Coefficient-of-thermal-expansion mismatch between alumina, ferrite, metal plates, conductive epoxy, and potting epoxy needs a temperature-cycle check.
- Alumina washer edge chipping or sharp metal burrs could dominate the local field even if the nominal geometry is rounded.
- FR4/G10 can absorb moisture and may leave rough glass fibers or resin smear after machining; clean and bake test coupons before HV tests.
- High-permittivity electroceramics can have large voltage and temperature coefficients, dielectric loss, and piezoelectric/microphonic response; treat piezoelectric candidates as likely no-go for the main washer dielectric.

## Source Links

- MG Chemicals SDS/TDS database: https://mgchemicals.com/sds-tds/
- MG Chemicals potting-compounds overview: https://mgchemicals.com/category/potting-compounds/
- Fair-Rite materials table: https://fair-rite.com/materials/
- FR-4 overview and typical relative permittivity: https://en.wikipedia.org/wiki/FR-4
- Dielectric-strength caveats and material overview: https://en.wikipedia.org/wiki/Dielectric_strength
- Macor machinable glass-ceramic overview: https://en.wikipedia.org/wiki/Macor
- Barium titanate high-permittivity electroceramic overview: https://en.wikipedia.org/wiki/Barium_titanate
- Lead zirconate titanate electroceramic overview: https://en.wikipedia.org/wiki/Lead_zirconate_titanate
- Strontium titanate dielectric overview: https://en.wikipedia.org/wiki/Strontium_titanate
- Partial discharge overview: https://en.wikipedia.org/wiki/Partial_discharge
- Alumina / aluminium oxide overview: https://en.wikipedia.org/wiki/Aluminium_oxide
- Vishay Beyschlag MMB 0207 professional MELF resistor datasheet: https://www.vishay.com/docs/28713/melfprof.pdf
