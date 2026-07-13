# Default-build thermal mismatch screen

## Result

The default MG Chemicals 9510 / alumina / copper stack cannot be assigned a
credible subzero operating limit from datasheets alone. The conservative
fully restrained screen predicts that the epoxy-to-alumina interface controls:

- Stress-free reference: 70 °C, the published glass-transition temperature.
- No cold target is assumed. The saved 20 °C evaluation point represents
  ordinary room-temperature handling, not a design requirement.
- At 20 °C, the nominal full-restraint stress is 15.2 MPa using an assumed
  3.0 GPa epoxy modulus and Poisson ratio 0.35.
- Published cured 9510 tensile strength: 20 MPa.
- Nominal strength margin at 20 °C: 1.32.
- Nominal full-restraint strength crossing: +4.1 °C.
- Modulus sensitivity, 2 to 4 GPa: -28.8 to +20.6 °C.
- If geometry and free edges reduce effective restraint to 50%, the nominal
  crossing moves to -61.7 °C.

Use +4 °C as the conservative onset-of-risk screen for the present default
geometry, not as a predicted fracture temperature. The broad restraint and
modulus sensitivity means the design has not earned a subzero rating.

Until bonded-ring coupons establish a qualified cold limit, transport the
assembly at controlled room temperature, preferably at or above 25 °C, and
avoid unheated or freezing shipment. This is interim risk management rather
than a qualified transport-temperature rating.

## Model

Below the epoxy glass transition, the first-order equibiaxial screen is:

```text
delta_epsilon = abs(alpha_epoxy - alpha_substrate) (Tg - T)
sigma = k E_epoxy delta_epsilon / (1 - nu_epoxy)
```

`k` is the effective restraint factor. `k = 1` is the conservative fully
restrained bound used for the default risk result. The first tensile-strength
crossing is found by setting `sigma` equal to 20 MPa.

The checked-in executable calculation and complete numeric output are:

- `software/bias_filter/thermal_stress.py`
- `simulations/thermal/outputs/default-thermal-stress.json`

## Data and assumptions

- MG Chemicals 9510: cure 3 h at 80 °C (minimum-temperature schedule), Tg
  70 °C, pre-Tg CTE 74 ppm/°C, cured tensile strength 20 MPa, lap shear 9.2 MPa
  on stainless and 5.8 MPa on aluminum, and bulk service range -65 to 150 °C.
- The same TDS, version 5.2 dated 23 January 2026, page 2, lists
  `Shrinkage 3.9% Calculated` in its Liquid Properties table. It does not define
  whether this is linear, volumetric, mass-based, or referenced to a particular
  cure/gel state. Page 3 separately reports 3.9% weight loss at 155 °C after
  600 hours; that is a different property despite the identical number.
- CoorsTek AD-96 alumina: CTE 8.2 ppm/°C and elastic modulus 303 GPa.
- C110 copper: CTE 16.9 ppm/°C.
- 9510 elastic modulus and Poisson ratio are not published. The model preserves
  an assumed 2 to 4 GPa modulus range, 3 GPa nominal, and Poisson ratio 0.35.

The TDS shrinkage entry is not added as 3.9% elastic strain. The manufacturer
does not publish its definition or the post-gel locked-in fraction, and the
assembly's cure restraint and stress relaxation are unknown. Existing project
phrases such as “liquid-to-cured shrinkage” are interpretations rather than TDS
wording. This provenance/definition issue is a priority follow-up; until it is
resolved, the thermal screen must not claim to include residual cure stress.

The manufacturer's -65 °C service floor describes the cured bulk material; it
does not qualify a bonded copper/alumina assembly. Interface pull-off strength,
fracture toughness, residual cure stress, voids, edge relief, and thermal-cycle
fatigue remain unmodeled.

## Qualification action

Build representative copper-tube / 9510 / alumina-ring coupons with the same
surface preparation, bond lengths, fill thickness, cure ramp, and cooling
fixture as the prototype. Inspect electrically and ultrasonically if possible,
then thermal-cycle in 10 °C increments with dwells. Do not assign a subzero
operating rating until the coupons establish a repeatable no-damage floor with
an appropriate margin.

## Primary sources

- MG Chemicals 9510 TDS, version 5.2, 23 January 2026:
  https://mgchemicals.com/downloads/tds/tds-9510.pdf
- CoorsTek Advanced Alumina property table:
  https://www2.coorstek.com/media/4235/advanced-alumina.pdf
- Copper Development Association C11000 properties:
  https://alloys.copper.org/alloy/C11000
- Vishay MMB 0207 datasheet (alumina ceramic body and operating range):
  https://www.vishay.com/docs/28963/mmu0102_mma0204_mmb0207.pdf
