# Potting epoxy selection

## Decision context

The fill must wet copper, alumina, and the resistive core without trapping gas.
For this DC detector-bias application, a datasheet dielectric-strength number is
not enough: small voids or a weak interface can become partial-discharge sites
even when the bulk material is well below its coupon breakdown field.

The current reference design uses **LOCTITE STYCAST 2850FT with CAT 23LV** as
both the washer-region dielectric and surrounding potting fill. The proposed
process uses the lower-viscosity, room-temperature-curing formulation for
vacuum filling, followed by a `2-4 h at 45 C` post-cure. The bake is intended
to advance cure and polymer-network development and stabilize the material
without imposing the former CAT 11 reference's `80 C` cooldown. No
one-part, low-viscosity, genuinely low-stress heat-cure epoxy with a complete
public property set was found. Parker CoolTherm ES-21 is one-part, but its
35,000 cP viscosity, Shore D88 hardness, 115 C Tg, and 125 C cure make it a
poor low-stress substitute for 9510.

## Published comparison

Values below are manufacturer datasheet values. Dielectric strength is
converted from V/mil to kV/mm. These are screening values, not guaranteed
partial-discharge inception fields or long-duration DC ratings.

| Material | Working time | Mixed viscosity | Hardness | Tg | Linear CTE below/above Tg | Shrinkage | Dielectric strength | Volume resistivity | Relative permittivity | Practical note |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Stycast 2850FT BL + CAT 11 | 4 h | 64,000 cP | Shore D96 | 115 C | 31.2 / 97.9 ppm/C | 0.2% linear | 15.0 kV/mm | 1e15 ohm-cm | 5.36 at 1 MHz | Heat-cure comparison. Mix 100:4.5 by weight and heat cure 8-16 h at 80 C. High viscosity makes open flow paths and in-mold vacuum especially important. |
| Stycast 2850FT + CAT 23LV | 1 h | 5,600 cP | Shore D92 | 40 C after room-temperature cure | 39.4 / 111.5 ppm/C | 0.3% linear | 14.8 kV/mm | 1e15 ohm-cm | 5.36 at 1 MHz | Current default: mix 100:7.5 by weight, cure 16-24 h at 25 C, then post-cure 2-4 h at 45 C when 45 C is the maximum expected service temperature. |
| MG 9510 | Unlimited before heat cure | 4,800 cP | Shore D84 | 70 C | 74 / 217 ppm/C | 3.9%, calculated and undefined basis | 15.75 kV/mm | 2.6e13 ohm-cm | 3.7 at 1 MHz | One-part and easy to degas at leisure, but rigid. Minimum cure is 3 h at 80 C. |
| MG 832FX | 2 h | 700 cP | Shore A88 | 8.8 C | 114 / 218 ppm/C | 2.6%, calculated | 12.99 kV/mm | 5.8e12 ohm-cm | 3.1 at 1 MHz | Best-flowing published MG flexible option; 1:1 mix and 2 min vacuum de-airing at 25 inHg. |
| MG 832FXT | 170 min | 1,920 cP | Shore A80 | 20 C | 124 / 295 ppm/C | 2.4%, calculated | 13.78 kV/mm | 1.5e13 ohm-cm | Lower tensile strength and apparently more compliant; available in 25 mL trial size. |
| MG 832FXC | 170 min | 410 cP | Shore A60 | 12 C | 212 / 260 ppm/C | 2.3%, calculated | 18.58 kV/mm | 1.0e13 ohm-cm | Lowest viscosity and softest listed epoxy; clear cure helps visual void inspection. |
| Epoxies Etc. 20-3241 | 30-45 min | 1,000 cP | Shore A75 | Not published | 50 ppm/C | 0.6% linear | 22.05 kV/mm | 5e15 ohm-cm | Strong published electrical and shrinkage figures and explicit adhesion to ceramics/copper, but short pot life and bulk packaging. |

The 832FXT and 832FXC datasheets do not publish relative permittivity. The web
model provisionally uses 3.1, inherited from the closely related 832FX. That
assumption must be replaced by a supplier value or a cured-coupon measurement
before capacitance predictions are frozen.

## Additional electrical presets (2026-09-22)

The selector and comparison slide now include these candidates. The Stycast
CAT 23LV default remains unchanged. "Not published" below means absent from
these public sources, not necessarily unavailable from the supplier.

| Material | Relative permittivity | Dielectric strength | Process and data limits |
| --- | --- | --- | --- |
| [3M DP270 clear/black](https://multimedia.3m.com/mws/media/1235390O/dp270-technical-data-sheets.pdf) | 3.5 at 1 kHz, 23 C | 850 V/mil = 33.46 kV/mm | 60-70 min work life; 1:1 by volume; 48 h at 23 C. D83; Tg 43 C onset / 49 C midpoint; resistivity 4.1e14 ohm-cm. Mixed viscosity is not tabulated. |
| [Master Bond EP30](https://www.masterbond.com/tds/ep30) | **3.2 provisional generic assumption** | 440 V/mil = 17.32 kV/mm | Base EP30, not EP30FL or EP30-2. 4:1 by weight; 24-48 h at 75 F. D80-90; component viscosities A 400-900 and B 280-500 cP, not a mixed value. Public page omits permittivity, resistivity, Tg and work life. |
| [MG Chemicals 832C](https://www.mgchemicals.com/downloads/tds/tds-832c-2parts.pdf) | 2.8 at 1 MHz | 483 V/mil = 19.02 kV/mm, tested at 3.175 mm | TDS v4.2, 20 February 2026: 3 h 15 min working time (100 g); mixed viscosity 2,700 cP; D84; Tg 53 C; resistivity 6.7e12 ohm-cm. Mix 2:1 by volume; 24 h room cure. |

EP30's assumed permittivity is identified in the selector, comparison row,
and selected-material note. Replace it using the epoxy permittivity control
once supplier data or a cured-coupon measurement is available. Do not borrow
properties from a different EP30 suffix without identifying that substitution.
The differing electrical test frequencies are not a broadband material model.

The new materials have a cure-schedule comparison and closed-form cooldown screen,
but no thermal FEA presets. DP270 and 832C use published piecewise CTE; EP30
thermal stress remains unavailable because its base-product CTE was not found.
See [the cure study](epoxy-cure-study.md) for sources, assumptions and results.

## Interpretation

- **Best small prototype:** MG 832FXT because a 25 mL package is available and
  its Shore A80 result indicates much greater compliance than 9510.
- **Best flow and balanced process:** MG 832FX at 700 cP with two hours of
  working time.
- **Best visual void inspection:** clear MG 832FXC. Its 410 cP viscosity should
  also make evacuation and narrow-gap filling easiest.
- **Best published electrical properties:** 20-3241, but its 30-45 minute pot
  life and gallon-scale packaging are significant prototype disadvantages.
- **Current baseline:** Stycast 2850FT/CAT 23LV provides a one-hour working
  window and `5,600 cP` mixed viscosity. The lower viscosity should improve
  vacuum filling of the 1 mm gaps. The selected room cure plus 45 C post-cure
  is meant to increase cure completion while limiting thermal mismatch.

MG recommends only two minutes at 25 inHg for vacuum de-airing the 832FX
family. A two- to nearly three-hour pot life therefore permits several
mix/degas/fill cycles. Long working time still helps, but unlimited working
time is not necessary for a carefully rehearsed small casting.

Hardness scales are not directly interchangeable: Shore A values for flexible
materials cannot be numerically compared with 9510's Shore D value. More
importantly, hardness is not Young's modulus. The flexible-epoxy datasheets do
not publish the temperature-dependent modulus or viscoelastic data needed for
a defensible thermal-stress FEA, so no modulus is inferred from Shore hardness.

Higher CTE by itself does not mean higher stress. A first-order restrained
thermal stress scales approximately as `E * delta_alpha * delta_T`; a much
lower elastic modulus can outweigh a larger CTE mismatch. Cure shrinkage,
stress relaxation, adhesion, and free-edge stress concentration also matter.

## Glass transition and provisional temperature control

A cured epoxy below its glass-transition temperature is in its relatively
stiff glassy state. Above Tg it is more compliant and viscoelastic, so molecular
segments can rearrange and bonded-in stress can relax through creep. A
cross-linked thermoset does not melt or freely flow above Tg; it remains a
connected solid. Tg is also a broad, time- and frequency-dependent transition,
not a sharp safe/unsafe boundary.

The low Tg values of the 832FX family may be useful rather than inherently
undesirable. At ordinary room temperature, MG 832FX (Tg 8.8 C) and 832FXC
(Tg 12 C) are above their nominal transitions and should be much more compliant
than 9510. MG 832FXT has a nominal Tg of 20 C, so a 20 C environment provides
essentially no transition margin for that material. On cooling through Tg, the
modulus can rise sharply and additional copper/alumina contraction mismatch can
become more strongly locked into stress.

For a flexible-epoxy prototype, use **20 C as a provisional absolute minimum**
for operation, storage, and transport, with **25 C or warmer preferred** until
bonded coupons establish a lower qualified limit. This requirement is practical
for the intended controlled environment, but it must include unpowered storage
and shipping rather than operation alone. A candidate should be cycled with
dwells at 25, 20, 10, 0, and -10 C while monitoring adhesion, leakage,
capacitance, and discharge pulses. For 832FXT in particular, 25 C is the more
credible provisional minimum because its nominal Tg is already 20 C.

## Qualification plan

Cast representative copper/alumina ring coupons using the actual cleaning,
surface preparation, vacuum process, cure schedule, and cool-down rate. For
each candidate:

1. Record mixed viscosity, elapsed process time, vacuum pressure, bubble
   behavior, cure schedule, and visual void count.
2. Measure capacitance and leakage before and after cure.
3. Thermal-cycle coupons through 25, 20, 10, 0, and -10 C while inspecting for
   interface whitening, cracks, delamination, leakage steps, and capacitance
   changes.
4. Perform stepped DC partial-discharge/current-pulse testing with the intended
   voltage polarity and a conservative dwell time.
5. Section sacrificial samples to check wetting at conductor edges and alumina
   interfaces.

Silicone encapsulants such as NuSil R-2188 (Shore A20) and Wacker ELASTOSIL
RT 601 (Shore A45) offer substantially more compliance and long working times.
They are useful fallback candidates, but they are not epoxy presets because
their adhesion, gas permeability, surface contamination, and rework behavior
need a separate design assessment.

## Thermal-model boundary

The closed-form calculation and FEniCSx thermal model contain presets for MG
9510 and Stycast 2850FT with CAT 11 or CAT 23LV. The CAT 23LV default uses the
published `39.4 ppm/C` pre-Tg CTE and conservatively treats the selected `45 C`
post-cure as the stress-free reference. This is a modeling assumption, not a
measured gel or stress-lock temperature. Henkel does not publish Young's
modulus or tensile strength for this system in the cited TDS, so the model retains an assumed
`3 GPa` modulus with a `2-4 GPa` sensitivity and a provisional `20 MPa` bulk
tensile comparison line. The published `117 MPa` flexural and `193 MPa`
compressive strengths for CAT 11 are not substituted for CAT 23LV tensile or interface strength.

## Primary sources

- [Henkel LOCTITE STYCAST 2850FT TDS, including CAT 11 and CAT 23LV](https://datasheets.tdx.henkel.com/LOCTITE-STYCAST-2850FT-en_GL.pdf)
- [Henkel LOCTITE STYCAST 2850FT BL product page](https://next.henkel-adhesives.com/us/en/products/compounds-for-electronics/central-pdp.html/loctite-stycast-2850ft-bl/stycast2850ft_1.html)
- [MG Chemicals 9510 TDS](https://mgchemicals.com/downloads/tds/tds-9510.pdf)
- [MG Chemicals 832FX TDS](https://mgchemicals.com/downloads/tds/tds-832fx-2parts.pdf)
- [MG Chemicals 832FXT TDS](https://mgchemicals.com/downloads/tds/tds-832fxt-2parts.pdf)
- [MG Chemicals 832FXC TDS](https://mgchemicals.com/downloads/tds/tds-832fxc-2parts.pdf)
- [Epoxies Etc. 20-3241 TDS](https://products.meridianadhesives.com/storage/downloads/1w7pjlbshwq9myufxb7kysdbnce7gahf/20-3241r-rev062025.pdf)
- [Parker CoolTherm ES-21 TDS](https://www.parker.com/content/dam/Parker-com/Literature/Assembly---Protection-Solutions-Division/Technical-Datasheets-%28TDS%29/Datasheet---CoolThermES-21_DS3623.pdf)
- [NuSil R-2188 product page](https://www.nusil.com/us/en/product/27944394/r-2188silicone-potting-and-encapsulating-elastomer)
- [Wacker ELASTOSIL RT 601 TDS](https://www.wacker.com/h/en-us/medias/ELASTOSIL-RT-601-AB-en-2020.02.10.pdf)

## Current web default: DP270, 2026-09-22

The user's planned potting material is now 3M DP270, including the entire
washer/gap region (relative permittivity 3.5). Copper plates and tube and
installation geometry are retained. The web built-in and installation defaults
use a 40 C provisional stress-free thermal reference. This is not a published
40 C full-cure schedule; cure duration and achieved Tg remain unverified.
The TDS lists Tg onset 43 C and midpoint 49 C; Tg is not a maximum cure
temperature. At 20 C, E=3 GPa, nu=0.35 and k=1, the 40 C reference gives
5.82 MPa for copper and 6.63 MPa for the ceramic-body proxy.

The MELF outer encapsulation is not characterized, so its actual interface
with potting epoxy is unknown. Bare-alumina adhesion must not be assumed.
Historical Stycast simulation bundles and hardware simulation reference files
remain identified by their original material and are not DP270 results.
DP270 thermal FEA remains unsupported.
