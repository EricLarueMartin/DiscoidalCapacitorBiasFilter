# Shared-geometry prototype plan

## Objective

Build one discoidal-capacitor mechanical envelope that can compare two
resistive-core approaches:

1. A commercial 0207 MELF resistor at each resistive section.
2. A Type 61 NiZn ferrite insert with approximately the same outside diameter.

The ferrite path is expected to provide much greater 50/60 Hz attenuation if
its bulk resistivity is near the current `1e8 ohm-cm` assumption. Its unknown
excess noise, bias dependence, contact resistance, and sample-to-sample
variation are the main reasons for prototyping both paths.

## Ferrite geometry criterion

Use a commercially available rod near the target diameter rather than grinding
a larger diameter down. The current pre-run reference uses 2.0 mm nominal OD.
Fair-Rite catalog parts demonstrate that 2.0 and 2.5 mm Type 61 rods are
ordinary purchasable sizes, but the prototype plan is not tied to one perfect
part number or distributor:

| Manufacturer part | Material | Rod diameter | Rod length | Prototype role |
| --- | --- | ---: | ---: | --- |
| Fair-Rite 3061990851 | Type 61 NiZn | 2.00 mm | 15 mm | Baseline ferrite insert |
| Fair-Rite 3061990861 | Type 61 NiZn | 2.50 mm | 20 mm | Alternate with less radial clearance |

The intended ferrite processing is limited to cross-cutting the rod into axial
sections, lapping or polishing the cut faces, cleaning, and inspection. The
prototype plan does not depend on reducing the rod diameter. Use a reasonably
available part that satisfies the geometry rather than delaying the prototype
for an ideal sourcing match.

## Shared first-article geometry

The off-the-shelf washer candidate is the 6.6 mm ID x 20 mm OD x 1.5 mm thick
alumina variant in Amazon listing B0GGR4WP38. Dimensions and alumina grade must
be checked on receipt because the listing combines multiple variants and is not
a controlled engineering drawing. This remains the best readily available
prototype washer geometry found so far; use it as the sourcing baseline rather
than delaying the first article for a thinner or custom washer.

Use the current parameterized copper envelope:

| Feature | Prototype value |
| --- | ---: |
| Washer | 6.6 mm ID x 20.0 mm OD x 1.5 mm thick |
| Bias plate flat OD | 20.0 mm |
| Bias plate maximum OD | 21.5 mm with 0.75 mm edge radius |
| Ground plate flat ID | 6.6 mm |
| Ground plate minimum ID | 5.1 mm with 0.75 mm edge radius |
| Bias and ground plate thickness | 1.5 mm |
| Ground tube ID | 26.0 mm |
| MELF core OD | 2.2 mm |
| Ferrite comparison OD | 2.0 mm |
| Bias voltage | 6 kV |
| Bias plates in first simulation | 2 |

The 2.0 and 2.2 mm inserts both clear the 5.1 mm minimum ground-plate ID. The
nominal minimum core-to-ground radial gaps are 1.55 mm for the 2.0 mm ferrite
and 1.45 mm for the 2.2 mm MELF. The same washers and conductor parts can
therefore test both paths without changing the primary capacitive geometry.

The purpose-sized 2.0 mm rod is preferred because it closely matches the
2.2 mm MELF package while preserving slightly more core-to-ground clearance.
The 2.5 mm rod also fits the same washer and plate envelope, with a nominal
1.30 mm core-to-ground radial gap, and can be retained as an alternate if its
measured resistance is more useful.

### Reference potting and assembly process

The fixed reference design uses **LOCTITE STYCAST 2850FT with CAT 23LV**. The
current Henkel TDS identifies CAT 23LV as the low-viscosity, long-pot-life,
room-temperature catalyst. Published mixed properties are 5,600 cP at 25 C,
one hour work life for a 100 g mass, and a 16 to 24 hour cure at 25 C. The same
TDS reports relative permittivity 5.36, dielectric strength 14.8 kV/mm, room-
temperature-cured Tg 40 C, pre-Tg CTE 39.4 ppm/C, Shore D92 hardness, and
0.3% linear cure shrinkage. CAT 11 gives a four-hour work life but requires a
heat cure, so it is not the reference catalyst.

Henkel recommends vacuum deairing at 1 to 5 mm Hg until most bubbling stops,
typically 3 to 10 minutes. The prior successful process of repeated pump-down
and vent cycles is consistent with the goal, but the vent return cannot fill a
sealed dead-end pocket. Fill from the lowest point, vent from the opposite high
point, and keep an outer annular manifold open around the washer stack.

The 1.5 mm stock washers need deliberate radial communication between inner
and outer epoxy regions. For a prototype, use at least three equally spaced
fill/vent paths per washer. Do not attempt ordinary end-mill machining on fired
alumina. Suitable routes are:

1. order custom washers with the channels green-machined before firing;
2. have a ceramic supplier laser-machine or diamond-grind the fired washers;
3. put shallow flow channels or metering features into the much easier-to-
   machine metal parts, then include their edge radii in the electric-field
   model.

A starting vendor-discussion geometry is three radial channels at 120 degrees,
approximately 0.2 to 0.3 mm deep and 0.8 to 1.2 mm wide, with generously
rounded roots. This is not yet a released dimension: flow testing with the
5,600 cP filled epoxy, ceramic strength review, capacitance correction, and
field modeling are required. A groove through alumina replaces part of the
high-permittivity washer with epoxy and introduces new dielectric interfaces.

Prefer shallow concentric locating pockets in the bias plates to center the
ends of each core section. They preserve axisymmetry and avoid adding a radial
object between the HV core and grounded plate. If permanent pins are still
needed, use smooth ceramic pins rather than metal or poorly bonded PTFE, give
epoxy a continuous path around them, and add the pins explicitly to the
electrostatic and capacitance geometry. Three radial pins touching the core and
approaching the grounded plate are not electrically neutral: they create
interfaces and can move the local peak field.

Primary data: [Henkel STYCAST 2850FT/CAT 23LV TDS](https://datasheets.tdx.henkel.com/LOCTITE-STYCAST-2850FT-CAT-23LV-en_GL.pdf).

### Continuous-epoxy construction branch

The Designer also supports `washer_material = epoxy`. In this branch there is
no mechanically distinct washer: the complete bias-to-ground gap and all
rounded-edge pockets use the selected potting epoxy. Washer permittivity and
provisional dielectric-strength guidance are linked to the epoxy selection,
and the thermal mesh assigns the former washer volume epoxy properties. The
washer ID and OD remain stored for reversible design comparison but do not
create a material boundary in the field or thermal models.

One candidate process is to solder or braze a self-supporting metal skeleton
with deliberate flow and vent gaps, vacuum-immerse it in low-viscosity epoxy,
then restore atmospheric pressure before cure. The pressure return can compress
and help dissolve residual gas while the resin is liquid, but it cannot rescue
a sealed dead-end pocket or guarantee that every microscopic void disappears.
The fixture therefore needs continuous fill paths, upward vent paths, adequate
spacing for viscous flow, and no trapped cups. Vacuum level and dwell must be
qualified against resin foaming, volatile loss, and premature cooling.

Flux and ionic residue are serious high-voltage risks. Prefer a fluxless or
fully cleanable joining process, then verify cleaning and surface wetting on
sectioned coupons. Cure shrinkage, metal-to-epoxy CTE mismatch, adhesion, and
viscoelastic relaxation remain even after the alumina-washer interface is
removed. The epoxy-filled model should therefore be compared with the alumina
baseline using the thermal FEA and then validated by thermal-cycled, partial-
discharge-tested coupons.

## Current circuit prediction

For alumina `epsr = 10`, the washer overlap estimate gives:

```text
one washer capacitance = 16.525 pF
two washers at one bias node = 33.049 pF
```

The fixed two-pair model includes a stage-matched input resistance, one
interior resistive section, the 10 m / 50 ohm cable model, a 10 pF detector,
and a 1 nA load at 6 kV.

| Result | MELF 0207 | Type 61, 2.0 mm |
| --- | ---: | ---: |
| Assumed stage resistance | 12 Mohm | 1.432 Gohm |
| Calculated adjacent-stage Cpar | 0.268 pF | 0.200 pF |
| Loaded attenuation at 50 Hz | 18.16 dB | 77.06 dB |
| Loaded attenuation at 60 Hz | 19.73 dB | 80.19 dB |
| Unloaded filter attenuation at 50 Hz | 0.45 dB | 47.10 dB |
| Unloaded filter attenuation at 60 Hz | 0.63 dB | 50.21 dB |

The MELF calculation uses the 12 Mohm value and the existing effective
alumina/metal-film capacitance model. The ferrite calculation uses
`rho = 1e8 ohm-cm`, `epsr = 12`, and a 2.0 mm cylinder across the 4.5 mm
bias-to-bias separation. The ferrite result is an assumption-sensitivity
prediction, not a Fair-Rite guaranteed resistance.

### Conductive-interleave sensitivity

If the measured ferrite resistance is too high, thin conductive discs can
replace part of the axial ferrite path. This sacrifices some of the ferrite's
resistive length and increases adjacent-stage parasitic capacitance, but may
provide a practical way to tune a stock rod without changing its diameter.

The web model represents the idea with `Ferrite conductor fill`, where `f` is
the fraction of each bias-to-bias path replaced by ideal conductive discs:

```text
R_stage(f) = R_stage(0) * (1 - f)
epsr_effective(f) = epsr_ferrite / (1 - f)
Cpar_core(f) = Cpar_core(0) / (1 - f)
```

This is the same one-dimensional equivalent-length approximation used for the
MELF film fill factor, with the added resistance scaling. It assumes the discs
span the core cross-section, have negligible resistance, and replace ferrite
length. It does not resolve disc edges, contact resistance, radial fringing,
local electric-field enhancement, or partial-discharge sites. The default is
`f = 0`; the pre-run ferrite results above therefore remain the unmodified-rod
baseline.

The 2.0 mm cross-section is also a useful diagnostic. If resistance and noise
come from many partly independent microscopic conduction paths, a smaller area
contains fewer paths and may show larger normalized fluctuations because less
spatial averaging occurs. Conversely, fewer active fluctuators may reduce some
absolute background contributions. Correlation, percolation, grain boundaries,
contact noise, fixed-voltage versus fixed-current bias, and sample volume all
affect the scaling. Do not assume the sign from geometry alone: report both
absolute voltage-noise density and normalized resistance noise such as
`S_R / R^2`, and compare at least one other readily available diameter if the
first result is promising or ambiguous.

The large difference between loaded and unloaded attenuation at 50/60 Hz is
caused by the modeled cable and detector capacitance. Both curves are useful:
the loaded result describes detector operation, while the unloaded result
describes voltage-noise attenuation at the filter output before the cable.

## Discrete-capacitor branch

Discrete high-voltage capacitors are a backup branch, not part of the baseline
prototype. If added capacitance becomes necessary, use a matched symmetric set
of at least two capacitors rather than a single asymmetric part. The Designer's
`Additional Cg` value adds the same capacitance to every bias node in the
circuit model while preserving the FEA washer capacitance and adjacent-plate
Cpar as separately reported quantities. Zero remains the baseline setting; a
one-node model can be used for sensitivity analysis but does not represent the
intended physical construction.

This can recover low-frequency attenuation without requiring the washer itself
to provide all of the capacitance. The capacitor must be evaluated as a
complete HV component: dielectric system, terminations, package voids,
voltage coefficient, leakage, dissipation, piezoelectric/microphonic behavior,
and partial-discharge data matter. Physical placement can also add adjacent
stage coupling and lead inductance that the ideal `Additional Cg` entry does
not model.

This branch is disfavored because previous HV-capacitor assemblies experienced
discharges when liquid potting could not be used. Dry encapsulation makes it
difficult to eliminate voids around packages and terminations. Do not promote
the branch unless the washer/core design cannot meet the required attenuation;
if it is needed, qualify the complete symmetric assembly for partial discharge,
leakage, voltage coefficient, loss, noise, and thermal cycling.

An alumina-rich mechanical variant is also under study. Machined alumina would
occupy most of the present bulk-epoxy volume, leaving thin epoxy bondlines to
take up tolerance. This may reduce polymer void volume and preserve a stable
non-piezoelectric dielectric around added capacitors, but it introduces more
interfaces and may concentrate shear in the thin joints. See
`docs/knowledge/partial-discharge-materials.md` and the checked-in thermal
study under `simulations/thermal/alumina-insert-study/`.

## Test sequence

1. Cut several nominal 2.0 mm rod sections and measure their dimensions and DC
   resistance.
2. Measure resistance versus length, applied voltage, temperature, and time to
   determine whether a meaningful bulk-resistivity model exists.
3. Compare ferrite voltage-noise spectra with the 12 Mohm MELF reference under
   representative DC bias. Record absolute noise and normalized resistance
   noise; add another available ferrite diameter if diameter scaling needs to
   be separated from sample variation.
4. Obtain and inspect the washer candidate for flatness, chips, actual
   dimensions, alumina grade, and water absorption or porosity data.
5. Build dry mechanical stacks for both 2.0 and 2.2 mm inserts before potting.
6. Use the epoxy sample for small copper/alumina/ferrite wetting and
   thermal-cycle coupons before committing the full assembly.
7. Pot electrically identical MELF and ferrite stacks, then compare
   attenuation, leakage, partial-discharge pulses, drift, and low-frequency
   noise.

## Sources

- [Amazon washer candidate B0GGR4WP38](https://www.amazon.com/gp/product/B0GGR4WP38)
- [DigiKey Fair-Rite 3061990851, 2.0 mm Type 61 rod](https://www.digikey.com/en/products/detail/fair-rite-products-corp/3061990851/8599512)
- [DigiKey Fair-Rite 3061990861, 2.5 mm Type 61 rod](https://www.digikey.com/en/products/detail/fair-rite-products-corp/3061990861/8599471)
- [Fair-Rite 17th Edition catalog](https://fair-rite.com/wp-content/uploads/2023/05/Fair-Rite_Catalog_17th_Edition.pdf)
