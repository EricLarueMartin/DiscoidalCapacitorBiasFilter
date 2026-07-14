# Potting epoxy selection

## Decision context

The fill must wet copper, alumina, and the resistive core without trapping gas.
For this DC detector-bias application, a datasheet dielectric-strength number is
not enough: small voids or a weak interface can become partial-discharge sites
even when the bulk material is well below its coupon breakdown field.

MG Chemicals 9510 remains the mechanically modeled baseline, but its rigid
cure and large CTE mismatch make lower-modulus materials worth testing. No
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
| MG 9510 | Unlimited before heat cure | 4,800 cP | Shore D84 | 70 C | 74 / 217 ppm/C | 3.9%, calculated and undefined basis | 15.75 kV/mm | 2.6e13 ohm-cm | 3.7 at 1 MHz | One-part and easy to degas at leisure, but rigid. Minimum cure is 3 h at 80 C. |
| MG 832FX | 2 h | 700 cP | Shore A88 | 8.8 C | 114 / 218 ppm/C | 2.6%, calculated | 12.99 kV/mm | 5.8e12 ohm-cm | 3.1 at 1 MHz | Best-flowing published MG flexible option; 1:1 mix and 2 min vacuum de-airing at 25 inHg. |
| MG 832FXT | 170 min | 1,920 cP | Shore A80 | 20 C | 124 / 295 ppm/C | 2.4%, calculated | 13.78 kV/mm | 1.5e13 ohm-cm | Lower tensile strength and apparently more compliant; available in 25 mL trial size. |
| MG 832FXC | 170 min | 410 cP | Shore A60 | 12 C | 212 / 260 ppm/C | 2.3%, calculated | 18.58 kV/mm | 1.0e13 ohm-cm | Lowest viscosity and softest listed epoxy; clear cure helps visual void inspection. |
| Epoxies Etc. 20-3241 | 30-45 min | 1,000 cP | Shore A75 | Not published | 50 ppm/C | 0.6% linear | 22.05 kV/mm | 5e15 ohm-cm | Strong published electrical and shrinkage figures and explicit adhesion to ceramics/copper, but short pot life and bulk packaging. |

The 832FXT and 832FXC datasheets do not publish relative permittivity. The web
model provisionally uses 3.1, inherited from the closely related 832FX. That
assumption must be replaced by a supplier value or a cured-coupon measurement
before capacitance predictions are frozen.

## Interpretation

- **Best small prototype:** MG 832FXT because a 25 mL package is available and
  its Shore A80 result indicates much greater compliance than 9510.
- **Best flow and balanced process:** MG 832FX at 700 cP with two hours of
  working time.
- **Best visual void inspection:** clear MG 832FXC. Its 410 cP viscosity should
  also make evacuation and narrow-gap filling easiest.
- **Best published electrical properties:** 20-3241, but its 30-45 minute pot
  life and gallon-scale packaging are significant prototype disadvantages.
- **Current baseline:** 9510 remains useful for comparison and has unlimited
  pre-cure working time, but it should not be assumed mechanically safer merely
  because it has a convenient process.

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

The current closed-form calculation and FEniCSx thermal model contain MG 9510
properties only. Selecting another epoxy changes electrical permittivity and
dielectric-strength screening, but it does not make the 9510 mechanical model
valid for that material. The thermal backend therefore remains restricted to
9510 until a candidate has credible modulus, Poisson-ratio, CTE, cure-reference,
and strength/interface data. A flexible candidate should first be compared by
coupon testing; a later FEA can add measured temperature-dependent or
viscoelastic properties.

## Primary sources

- [MG Chemicals 9510 TDS](https://mgchemicals.com/downloads/tds/tds-9510.pdf)
- [MG Chemicals 832FX TDS](https://mgchemicals.com/downloads/tds/tds-832fx-2parts.pdf)
- [MG Chemicals 832FXT TDS](https://mgchemicals.com/downloads/tds/tds-832fxt-2parts.pdf)
- [MG Chemicals 832FXC TDS](https://mgchemicals.com/downloads/tds/tds-832fxc-2parts.pdf)
- [Epoxies Etc. 20-3241 TDS](https://products.meridianadhesives.com/storage/downloads/1w7pjlbshwq9myufxb7kysdbnce7gahf/20-3241r-rev062025.pdf)
- [Parker CoolTherm ES-21 TDS](https://www.parker.com/content/dam/Parker-com/Literature/Assembly---Protection-Solutions-Division/Technical-Datasheets-%28TDS%29/Datasheet---CoolThermES-21_DS3623.pdf)
- [NuSil R-2188 product page](https://www.nusil.com/us/en/product/27944394/r-2188silicone-potting-and-encapsulating-elastomer)
- [Wacker ELASTOSIL RT 601 TDS](https://www.wacker.com/h/en-us/medias/ELASTOSIL-RT-601-AB-en-2020.02.10.pdf)
