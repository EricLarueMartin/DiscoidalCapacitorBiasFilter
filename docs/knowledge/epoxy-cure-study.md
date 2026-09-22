# Epoxy cure-temperature screening, 2026-09-22

User intent: make DP270, base EP30 and 832C available live; compare datasheet
dielectric strength, CTE, adhesion and cooldown from an elevated cure.

## Sources and properties

| Material | Dielectric strength | CTE below / above Tg (ppm/C) | Bond result |
| --- | --- | --- | --- |
| [3M DP270](https://multimedia.3m.com/mws/media/1235390O/dp270-technical-data-sheets.pdf) | 33.46 kV/mm (850 V/mil) | 80 / 180; Tg onset 43 C, midpoint 49 C | At 23 C after 7 days at 23 C: Cu/Cu lap shear 11.72-12.07 MPa; etched Al/Al 16.89-17.24 MPa. Bulk tensile not supplied. |
| [Master Bond EP30](https://www.masterbond.com/tds/ep30) | 17.32 kV/mm (440 V/mil) | Not found in public base-EP30 data | Al/Al lap shear >20.68 MPa (>3,000 psi), from the [manufacturer's 2009 release](https://www.masterbond.com/newsrelease/ep30), not a current downloadable TDS. Confirm current test conditions. |
| [MG 832C](https://www.mgchemicals.com/downloads/tds/tds-832c-2parts.pdf) | 19.02 kV/mm (483 V/mil at 3.175 mm) | 150 / 161; Tg 53 C | Lap shear: stainless 17 MPa, aluminum 18 MPa. Separate bulk tensile test: 45 MPa. No copper/alumina interface value. |

The 3M source is February 2016; MG is v4.2 dated 20 February 2026. Master
Bond supplies its full EP30 TDS by email; it was not requested on the user's
behalf. EP30-2 and EP30FL are different formulations and are not substitutes.
EP30's electrical relative permittivity remains an explicit generic 3.2 assumption.

## Cure choices and calculated cooldown

Published full-cure alternatives, not an optimization of dielectric breakdown.
The selected comparison defaults are 80 C for DP270/832C and 93.3 C for EP30;
these defaults do not mean the hottest cure is recommended.

Calculation at 20 C: assumed E = 3 GPa, nu = 0.35, radial/hoop restraint k = 1.
Substrate CTE: copper 16.9 and alumina 8.2 ppm/C. Sigma = k E times the
integral of differential CTE over cooldown, divided by (1 - nu). The whole
assembly is assumed stress-free at the cure temperature. Piecewise CTE uses
49 C for DP270 and 53 C for 832C. The DP270 transition is approximated by
extending measurements over 5-30 C and 60-125 C to a sharp Tg switch.

| Material | Cure schedule | Copper stress (MPa) | Alumina stress (MPa) |
| --- | --- | ---: | ---: |
| DP270 | 48 h at 23 C | 0.87 | 0.99 |
| DP270 | 4 h at 50 C | 9.20 | 10.40 |
| DP270 | 1 h at 80 C | 31.78 | 34.19 |
| DP270 | 30 min at 100 C* | 46.84 | 50.05 |
| EP30 | 24-48 h at 75 F (23.9 C) | Unavailable | Unavailable |
| EP30 | 2-3 h at 200 F (93.3 C) | Unavailable | Unavailable |
| 832C | 24 h at room temperature, assumed 25 C | 3.07 | 3.27 |
| 832C | 1 h at 65 C | 28.25 | 30.06 |
| 832C | 30 min at 80 C | 38.23 | 40.64 |
| 832C | 15 min at 100 C | 51.53 | 54.74 |

*3M's full-cure table lists 100 C, but nearby text says heat up to 93 C;
confirm that inconsistent entry with 3M before using it. The older 65 C
handling/tack-free schedule is not used as a full-cure schedule.

These are elastic sensitivity results, not predictions of residual stress or
interface failure. Modulus is not measured for these materials here; 2-4 GPa
scales the numbers by 2/3 to 4/3. Stress relaxation, temperature-dependent E,
shrinkage, gelation, local stress concentrations and changing Tg with cure
are omitted. A hot oven temperature need not be the actual stress-lock
 temperature. The very low room-cure cooldown estimates omit cure-shrinkage
stress and must not be interpreted as negligible total residual stress.

Lap-shear results depend on substrate, preparation, bondline and loading mode;
they are not normal-traction debonding thresholds for a potted ring. The 832C
bulk strength comparison is distinct from its lap-shear data. No pass/fail
margin is assigned to DP270 or EP30 using a borrowed tensile strength.

None of the cited sources establishes dielectric-strength improvement versus
these cure schedules. Heat can advance cure, but hotter does not by itself
mean better breakdown performance in the assembled filter: voids and
cooldown damage also matter. Qualify the actual cure and surface preparation
with copper/alumina coupons and electrical testing.

## Implementation and reproduction

The live Thermal panel includes the schedule selector, manufacturer links,
all-schedule comparison and selected-material readouts. The thermal slide
uses the selected schedule for DP270/832C; EP30 explicitly displays missing
CTE. Thermal FEA for these materials remains unavailable. Stycast remains
the installation default.

Run: node software/bias_filter/test_epoxy_cure.cjs

[Machine-readable results and 2-4 GPa sensitivity](epoxy-cure-calculations.json)
are generated from the same pure calculation functions in
presentations/web/epoxy-cure.js. Tests cover the Tg integral, zero cooldown,
restraint scaling, missing data, bulk tensile margin and cure selection.

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
