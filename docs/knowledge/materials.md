# Materials Notes

## Current Candidate Stack

Status: two candidate prototype cores sharing one mechanical stack; neither has yet been validated by high-voltage or low-frequency-noise testing.

- Washer dielectric: both prototype paths use stock alumina washers. Alumina is readily sourced, mechanically robust, and a conservative high-voltage ceramic choice, but its moderate relative permittivity limits the available shunt capacitance compared with high-k ceramics. That limitation is especially important for the lower-resistance MELF option at 50/60 Hz.
- Potting and fill: MG Chemicals 9510 One-Part Epoxy Potting Compound, Heat Cure. MG's SDS/TDS database lists 9510 as a one-part epoxy potting compound in liquid format. Pull the dielectric constant, dielectric strength, volume resistivity, cure schedule, shrinkage, and thermal limits from the current TDS before freezing model defaults.
- Resistive core / conductor path A: Fair-Rite type 61 NiZn ferrite is the first concrete bulk-resistive sample set. Its nominal resistivity is near the compact high-resistance target and it can be machined into discs, but excess 1/f noise from the polycrystalline conduction path is a primary measurement risk.
- Resistive core / conductor path B: high-value MELF resistors provide a specified, repeatable, low-noise component path. Readily available per-stage resistance is lower than preferred; combined with alumina's modest capacitance, the present simulated ladder gives poor attenuation at power-line frequency.
- Shared conductors: both prototypes use machined copper bias/ground plates and a copper ground tube because those parts are readily sourced and fabricated.
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
- `Use package diameter`: when the selected component has a known package OD,
  derive and lock Core OD to that value. Current package-derived values are
  1.4 mm for MELF 0204 and 2.2 mm for MELF 0207. Disable it for manual Core OD;
  materials without a known package diameter remain manual automatically.
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

### Alumina purity and detector-bias partial discharge

Commercial 96% alumina is a dense ceramic with sintering aids and secondary
phases; the remaining percentage is not a porosity percentage. Representative
Vishay substrate data give 96% alumina `epsr = 9.6`, loss tangent `0.0002`, and
dielectric strength `19 kV/mm`, compared with `epsr = 9.8--9.9`, loss tangent
`0.0001`, and dielectric strength `23 kV/mm` for 99.5--99.6% grades. These are
grade- and test-specific examples, not universal acceptance values:

https://www.vishay.com/docs/48666/_ms12821832-2306_design-guidelines_ultrasource_reduced-file-size.pdf

For DC detector bias, a small partial discharge matters even when it cannot
bridge the insulation: its current pulse can couple into the detector signal.
Likely initiation sites are gas voids, cracks, surface contamination, and
epoxy/ceramic delamination. A gas void can carry a much higher local field than
the surrounding solid because of the permittivity discontinuity. Wall charge
may temporarily extinguish a DC discharge, but leakage, relaxation, ripple, or
ionization can permit intermittent recurrence.

Treat purity as secondary to explicit density/open-porosity, water-absorption,
surface-finish, edge-quality, and dielectric-test specifications. Higher-purity
substrates are often available with finer surfaces, but a well-finished 96%
washer with complete epoxy wetting is preferable to a nominally purer part
that traps air or develops a weak interface. Coupon qualification should
include cleaning and drying, representative vacuum-assisted potting, the real
cure schedule, thermal cycling, and a sensitive DC partial-discharge or
current-pulse test.

## Epoxy Fill Options

The epoxy fill is selectable in the web model. MG Chemicals 9510 remains the
mechanical-analysis baseline, while flexible candidates are included for
electrical and process comparison.

Current web presets:

| Preset | Web epsr | Dielectric strength | Use |
| --- | ---: | ---: | --- |
| MG Chemicals 9510 | 3.7 | 15.75 kV/mm | One-part, heat-cured mechanical baseline. |
| MG Chemicals 832FX | 3.1 | 12.99 kV/mm | Low-viscosity flexible epoxy with two-hour working time. |
| MG Chemicals 832FXT | 3.1, provisional | 13.78 kV/mm | Flexible small-package prototype candidate. |
| MG Chemicals 832FXC | 3.1, provisional | 18.58 kV/mm | Clear, very low-viscosity option for void inspection. |
| Epoxies Etc. 20-3241 | 4.7 | 22.05 kV/mm | Low-stress candidate with strong published electrical data but short pot life. |
| Generic potting epoxy | 3.2 | 15 kV/mm | Sensitivity placeholder for ordinary epoxy potting compounds. |
| Low-k epoxy | 2.8 | 15 kV/mm | Sensitivity placeholder for lower-permittivity fill choices. |
| Custom | user-set | unset | Manual value for datasheet or measured candidates. |

See `docs/knowledge/epoxy-selection.md` for the complete process/property
comparison, source links, silicone alternatives, and qualification plan. The
832FXT and 832FXC permittivities are explicit estimates from the related 832FX,
not published values.

## Thermal mismatch warning

The heat-cured default 9510/alumina/copper assembly has a potentially limiting
cold-temperature bond risk even though the cured epoxy itself is specified to
-65 °C. The conservative fully restrained screen predicts a nominal strength
crossing near +4 °C; the assumed 2 to 4 GPa modulus range moves the crossing
from approximately -29 to +21 °C, while a 50% restraint sensitivity moves it
to approximately -62 °C. This wide range is caused by
unpublished 9510 modulus/interface-fracture data and uncertain free-edge relief.

Treat `docs/knowledge/thermal-stress.md` and
`simulations/thermal/outputs/default-thermal-stress.json` as the calculation of
record. Do not assign a subzero assembly rating until representative bonded-ring
coupons survive staged thermal cycling. Until then, transport the assembly at
controlled room temperature, preferably at or above 25 °C, and avoid unheated
or freezing shipment.

The 3.9% shrinkage number currently carried by the thermal calculation comes
from the MG Chemicals 9510 TDS, version 5.2 (23 January 2026), page 2. In the
Liquid Properties table the complete entry is `Shrinkage 3.9% Calculated`.
The TDS does not say whether it is linear, volumetric, mass-based, or tied to a
specific cure/gel reference state. It also reports a separate 3.9% weight loss
at 155 °C after 600 hours on page 3; do not confuse that unrelated property
with shrinkage. Resolving the definition and the post-gel locked-in fraction is
a priority follow-up before residual cure stress is added to the model.

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
