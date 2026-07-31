# Partial-discharge material comparison

## Scope

This note evaluates insulation choices for a DC detector-bias filter. It does
not assign a universal partial-discharge inception voltage (PDIV) to a bulk
material. PD begins in a complete insulation system: gas-filled voids,
delaminations, surface gaps, conductor edges, contamination, pressure,
temperature, voltage history, ripple, and rise time can dominate the bulk
dielectric name.

The 2022 review by Li et al. is the best overview found for this use. It
summarizes experimental DC-PD studies in gaseous, solid, and liquid insulation
and emphasizes that DC behavior differs from AC because charge injection,
surface charge, conductivity, and relaxation history reshape the field.

## Objective comparison

| Construction | Expected PD behavior in this geometry | Main benefit | Main concern | Present assessment |
| --- | --- | --- | --- | --- |
| Dense alumina plus thin epoxy joints | Bulk ceramic should be resistant to polymer erosion; PD risk moves to chips, cracks, pores, triple points, and incompletely wetted joints. | Stable low-loss, non-piezoelectric dielectric with much less bulk polymer volume. | More ceramic pieces create more interfaces; one trapped seam void can erase the benefit. | Strong candidate if pieces are dense, smooth, inspected, dried, and vacuum wetted. |
| Bulk cast epoxy | Void-free material can insulate well, but an internal gas void or debond can discharge, erode, tree, and eventually puncture the polymer. | Simple geometry and few part interfaces. | Degassing, cure shrinkage, CTE mismatch, adhesion, and crack growth. | Retain as the baseline and coupon control, not as automatically safer. |
| Alumina-filled epoxy | Alumina filler can improve resistance to PD erosion relative to neat epoxy. | Better erosion resistance without machining every volume. | Filler does not remove macroscopic voids or weak bonded interfaces; viscosity can make impregnation harder. | Useful supplier-led option when rheology and void control are documented. |
| Silicone gel or liquid | Compliance reduces stored thermal stress, but PDIV is not inherently higher than a well-made epoxy/ceramic system. | Stress relief and reparability. | Mobile bubbles, surface paths, contamination, and field redistribution under DC. | Worth a controlled coupon comparison, not a default winner. |
| Mineral or dielectric oil | Can impregnate gaps and does not store the same elastic stress as cured epoxy. | Replaceable, inspectable fill with no cure shrinkage. | Bubbles, containment, contamination, conductivity/space-charge effects, and leakage. | Mechanically attractive but operationally more complex. |
| High-k ferroelectric ceramic capacitor | A qualified HV capacitor can add far more shunt capacitance than the washer alone. | Direct improvement at 50/60 Hz. | Termination and package void PD, voltage coefficient, dielectric loss, piezoelectric noise, leakage, and added Cpar. | Evaluate complete capacitor parts by rated DC voltage, PD test data, leakage, and noise; do not select on nominal capacitance alone. |

Semenov et al. tested ceramic substrates in silicone liquid, silicone gel, and
mineral oil. In their geometry, switched-waveform PDIV was substantially lower
than sinusoidal PDIV; gel and silicone liquid were similar, while mineral oil
was lower, particularly under switched voltage. This does not rank those media
for the present DC filter, but it directly demonstrates that surrounding medium
and waveform can overturn a simple material ranking.

Separate epoxy studies provide two useful bounds. Gas-filled defects in epoxy
have been observed to progress from changing discharge patterns to treeing and
puncture. Conversely, alumina and silica nanofillers improved epoxy PD erosion
resistance, and a nano/micro-filled epoxy was the strongest specimen in one
comparison. That evidence supports alumina as an erosion-resistant constituent;
it does not prove that an alumina/epoxy interface is void-free or resistant to
debonding.

## Alumina-rich construction

The proposed construction replaces most of the currently cast epoxy volume
with machined alumina pieces shaped close to the conductor stack. A thin epoxy
layer fills tolerances and bonds the pieces. Electrically, this can reduce the
volume in which a bulk epoxy void can occur and replace much of the low-epsilon
epoxy with stable alumina. Thermally, it reduces the distance over which the
epoxy accumulates free differential contraction, but it also confines thin
bondlines between stiff solids and can increase local shear.

This is therefore a geometry to simulate and coupon-test, not an automatic PD
improvement. Qualification should include:

1. Inspect ceramic density, open porosity, flatness, finish, chips, and cracks.
2. Dry and clean every part using a repeatable process.
3. Vacuum wet the assembled thin joints, then inspect for continuous bondlines.
4. Thermal-cycle representative copper/alumina joints while monitoring leakage and discharge pulses.
5. Test with DC plus realistic ripple and ramp transients; a sinusoidal hipot alone is not equivalent.

## CTE alternatives

The current model uses 8.2 ppm/K for AD-96 alumina and 16.9 ppm/K for copper.
Published values depend on grade and temperature interval; comparisons must use
the same interval before final selection.

| Option | Representative CTE | Electrical implication | Assessment |
| --- | ---: | --- | --- |
| Alumina | 7.2 ppm/K, 40-400 C in Kyocera's table; 8.2 ppm/K in the current AD-96 model | epsr about 9.9, low loss, 15 kV/mm coupon dielectric strength in the Kyocera table | Best-understood dielectric baseline. |
| Zirconia | 10.5 ppm/K, 40-400 C | epsr 33, higher listed loss factor, 11 kV/mm | Closer to copper, but only partially; electrical trade is substantial. |
| Aluminum nitride | 4.6 ppm/K, 40-400 C | epsr 8.5-8.6, 14-16 kV/mm | Worse CTE match to copper than alumina; no thermal-stress advantage here. |
| Grade 2 titanium conductor | 8.4-10 ppm/K | About 3.7% IACS, still effectively equipotential for these plates | Most accessible near-match; investigate oxide/contact and machining behavior. |
| Mo-Cu 70/30 conductor | 8.2 ppm/K, 20-100 C; at least 26 MS/m | High conductivity and an almost exact nominal CTE match | Technically excellent, but specialty sourcing and machining may dominate cost. |
| Mo-Cu 65/35 conductor | 8.6 ppm/K, 20-100 C; at least 27 MS/m | High conductivity, close CTE match | Similar conclusion to 70/30. |
| Mo-Cu 80/20 conductor | 6.3 ppm/K, 20-100 C; at least 20 MS/m | High conductivity, slightly below alumina CTE | Useful if the actual ceramic grade is lower expansion. |
| Kovar/Ceramvar-class conductor | Controlled expansion for glass/ceramic seals | Lower conductivity; Fe-Ni-Co alloys are magnetic | Established seal technology, but magnetic material near the detector is a serious system concern. |

Changing the plate material from copper to titanium or Mo-Cu is more attractive
than changing alumina to zirconia solely for CTE: it preserves alumina's known
electrical behavior. Titanium is the practical prototype option. Mo-Cu is the
best numerical CTE/conductivity combination found, but likely a later custom
part. Either choice requires a revised FEA with its actual modulus, Poisson
ratio, CTE interval, and plate/tube allocation; changing only the CTE would not
be mechanically valid.

## Sources

- Li et al., *Understanding DC Partial Discharge: Recent Progress, Challenges, and Outlooks*, CSEE Journal of Power and Energy Systems 8(3), 2022: https://www.sciopen.com/article/10.17775/CSEEJPES.2021.04740
- Semenov et al., *Partial Discharge Inception in Ceramic Substrates Embedded in Silicone Liquid, Silicone Gel, and Mineral Oil at Fast Voltage Rise and Sinusoidal Voltage*, IEEE TDEI 31(4), 2024: https://www.sintef.no/en/publications/publication/0198cc586224-b5837f64-e66b-4f48-8333-685c1de4a76c/
- Iizuka and Tanaka, *Comparison of Partial Discharge Resistance of Several Nanocomposites*, IEEJ 131(6), 2011: https://www.jstage.jst.go.jp/article/ieejfms/131/6/131_6_414/_article/-char/en
- Hikita et al., epoxy gas-void PD degradation study, IEEJ 122(6), 2002: https://www.jstage.jst.go.jp/article/ieejfms/122/6/122_6_557/_article/-char/ja/
- Kyocera advanced-ceramic property table: https://global.kyocera.com/prdct/fc/product/pdf/high_tech.pdf
- H.C. Starck Solutions Mo-Cu composite data: https://www.hcstarcksolutions.com/wp-content/uploads/PD-7101_1-MoCu-Composites.pdf
- Robert Laminage Grade 2 titanium data: https://www.robertlaminage.com/en/node/521
- Carpenter Technology controlled-expansion alloy guide: https://www.carpentertechnology.com/blog/selecting-controlled-expansion-alloys
