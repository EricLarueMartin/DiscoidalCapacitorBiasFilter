# Default-build thermal mismatch analysis

## Result

The default MG Chemicals 9510 / alumina / copper stack cannot yet be assigned
an interface-separation temperature from datasheets alone. Two bulk-stress
calculations are kept side by side: a simple differential-contraction baseline
and an axisymmetric thermoelastic FEniCSx model of the perfectly bonded
geometry.

The closed-form equibiaxial plane-stress baseline predicts that the
epoxy-to-alumina CTE difference controls:

- Stress-free reference: 70 °C, the published glass-transition temperature.
- No cold target is assumed. The saved 20 °C point is only the default
  temperature at which stress is evaluated.
- At 20 °C, the nominal biaxial `k = 1` stress is 15.2 MPa using an assumed
  3.0 GPa epoxy modulus and Poisson ratio 0.35.
- Published cured 9510 tensile strength: 20 MPa.
- Nominal strength margin at 20 °C: 1.32.
- Nominal biaxial `k = 1` strength crossing: +4.1 °C.
- Modulus sensitivity, 2 to 4 GPa: -28.8 to +20.6 °C.
- If geometry and free edges reduce effective restraint to 50%, the nominal
  crossing moves to -61.7 °C.

The +4 °C result is the point where the nominal plane-stress curve crosses the
published 20 MPa bulk tensile strength. It is neither the onset of thermal
stress, a conservative upper bound, nor a prediction of separation. The
current models do not calculate the temperature at which an epoxy-to-alumina
or epoxy-to-copper interface opens and creates a void.

## Continuous-epoxy gap sensitivity

The washer-material menu includes a linked epoxy option that removes the
distinct alumina washer and assigns the complete dielectric gap the selected
potting-epoxy properties. A matched 0.30 mm default-geometry comparison used
9,276 cells for the alumina model and 9,272 cells for the continuous-epoxy
model. At 20 C, continuous epoxy reduced epoxy P99 maximum-principal tension
from 31.741 to 27.208 MPa (-14.3%) and P99 axial tension from 29.489 to
21.054 MPa (-28.6%). It increased P99 absolute r-z shear from 12.618 to
13.675 MPa (+8.4%) and P99 von Mises stress from 24.671 to 25.589 MPa
(+3.7%).

This is a useful stress redistribution, not evidence that an all-epoxy design
eliminates thermal risk. The core and metal interfaces remain, and the current
perfect-bonded linear model still excludes cure shrinkage, viscoelastic
relaxation, cohesive failure, solder joints, and void formation. Raw results
and exact inputs are retained under
`simulations/thermal/continuous-epoxy-study/`.

## What strength data are actually published for 9510?

The MG Chemicals 9510 technical data sheet reports a cured tensile strength of
`20 N/mm^2` (20 MPa). It does **not** report a bulk shear strength. Its ASTM
D1002 lap-shear results are adhesive-joint tests and depend on the named
substrate: 9.2 MPa on stainless steel, 5.8 MPa on aluminum, 3.8 MPa on ABS,
and 1.1 MPa on polycarbonate. No copper or alumina lap-shear value is
published in that sheet.

Those lap-shear numbers must not be used as a failure threshold for the local
`r-z` epoxy shear reported by the axisymmetric FEA. The stress state, specimen
geometry, interface preparation, and substrates are different. Qualification
still requires tensile/cleavage and shear coupons made with the actual copper
or selected conductor finish, machined alumina, surface preparation, bondline,
and heat-cure schedule.

Source: [MG Chemicals 9510 Technical Data Sheet](https://mgchemicals.com/downloads/tds/tds-9510.pdf).

## Closed-form baseline

Below the epoxy glass transition, the first-order equibiaxial estimate is:

```text
delta_epsilon = abs(alpha_epoxy - alpha_substrate) (Tg - T)
sigma = k E_epoxy delta_epsilon / (1 - nu_epoxy)
```

`k` is a dimensionless effective-restraint factor: the fraction of the free
epoxy/substrate differential thermal strain prevented in the radial and
circumferential (hoop) directions. The approximation assumes
`sigma_rr = sigma_theta_theta = sigma` and
`sigma_zz = sigma_rz = 0`. `k = 1` restrains all of that radial and hoop
mismatch; `k = 0.5` restrains half; `k = 0` gives free contraction and zero
mismatch stress. It is not a spring constant, an interface displacement, or a
fraction of cure shrinkage. Lower values lump together possible relief from
free-edge deformation, compliance of the surrounding materials or interface,
and viscoelastic stress relaxation.

The factor affects only the closed-form baseline. The thermal FEA has no `k`
input: it assumes perfectly bonded interfaces and calculates displacement and
stress from the actual modeled geometry and material stiffnesses. The first
tensile-strength crossing in the closed-form model is found by setting `sigma`
equal to 20 MPa. This calculation intentionally remains in the project because
it is transparent, fast, and independent of the FEA mesh.

### Basis of the stress equation

The baseline treats the epoxy as an isotropic annular layer with equal radial
and hoop stresses, `sigma_rr = sigma_theta_theta = sigma`, and zero axial and
r-z shear stress. Under plane stress, the elastic strain in either restrained
direction is

```text
epsilon_elastic = (sigma - nu sigma) / E = sigma (1 - nu) / E
```

Setting that elastic strain equal to the restrained differential thermal
strain gives

```text
sigma = k E delta_epsilon / (1 - nu)
```

This is the origin of the `1 / (1 - nu)` term. It is a uniform equibiaxial
plane-stress assumption, not a solution of the actual bonded-ring geometry or
a maximum-stress bound. The restraint factor `k` is an explicit sensitivity
parameter; the FEA replaces that assumed uniform restraint with displacement
compatibility in the modeled geometry.

The stress-free reference is assumed to be the 9510 glass-transition
temperature, 70 C. The calculation assumes stresses relax above this point and
begin accumulating as the bonded assembly cools below it. That reference is an
engineering assumption, not a measured stress-free temperature for this cure
process.

### Default numerical substitution at 20 C

For the epoxy-to-alumina interface:

```text
alpha_epoxy   = 74.0e-6 /C
alpha_alumina =  8.2e-6 /C
delta_alpha   = 65.8e-6 /C
delta_T       = 70 C - 20 C = 50 C

delta_epsilon = 65.8e-6 * 50 = 0.00329 = 0.329%
sigma         = 1.0 * 3000 MPa * 0.00329 / (1 - 0.35)
              = 15.1846 MPa
strength margin = 20 MPa / 15.1846 MPa = 1.317
```

At the 10 mm washer outer radius, the corresponding free radial mismatch is

```text
delta_r = 0.00329 * 10 mm = 0.0329 mm = 32.9 um
```

For comparison, the epoxy-to-copper calculation uses
`delta_alpha = (74.0 - 16.9)e-6 = 57.1e-6 /C`, giving 13.1769 MPa. Its free
radial mismatch is 37.115 um at the larger 13 mm tube radius. Alumina controls
the stress comparison because stress in this baseline depends on CTE mismatch,
not radius; radius is used only to report the free displacement mismatch.

### Tensile-strength crossing

Solving the stress equation for the temperature drop at the published 20 MPa
cured tensile strength gives

```text
delta_T_crossing = strength * (1 - nu) / (k E delta_alpha)
T_crossing = 70 C - delta_T_crossing
```

For alumina, `E = 3000 MPa`, `nu = 0.35`, and `k = 1`:

```text
delta_T_crossing = 20 * 0.65 / (1.0 * 3000 * 65.8e-6)
                 = 65.8561 C
T_crossing       = 70 - 65.8561 = 4.1439 C
```

The same calculation gives the documented sensitivity values:

| Assumption | Calculated strength crossing |
| --- | ---: |
| `E = 2 GPa`, `k = 1` | -28.784 C |
| `E = 3 GPa`, `k = 1` | +4.144 C |
| `E = 4 GPa`, `k = 1` | +20.608 C |
| `E = 3 GPa`, `k = 0.5` | -61.712 C |

These crossings compare a calculated bulk epoxy stress with the published bulk
tensile strength. They are reference points, not predictions of interface
debonding or fracture temperature.

### Why the FEA is higher

The `k = 1` baseline is fully restrained only within its two-direction
plane-stress assumption. It explicitly sets the third principal stress to
zero. A uniform material constrained equally in all three directions instead
has

```text
sigma_triaxial = E delta_epsilon / (1 - 2 nu)
```

For the same default alumina mismatch at 20 C:

```text
sigma_triaxial = 3000 MPa * 0.00329 / (1 - 2 * 0.35)
                = 32.9 MPa
```

This is close to the refined FEA P99 result of 32.1 MPa. Axisymmetry means the
solution has no variation with circumferential angle and no circumferential
displacement component; it does not remove circumferential strain. A radial
displacement changes circumference, giving
`epsilon_theta_theta = u_r / r`. The FEA therefore includes the normal
components `sigma_rr`, `sigma_zz`, and `sigma_theta_theta`, plus `sigma_rz`
shear. The agreement suggests that much of the high-stress epoxy is locally
confined in all three normal directions. Material junctions and free edges
also introduce shear, peel, and stress gradients absent from the uniform
closed form; the raw corner maximum is higher still and remains mesh
sensitive.

The thermal-limit slide treats the FEA P99 maximum-principal tensile stress as
the most limiting displayed stress trend because its tensor includes axial
stress and r-z shear as well as radial and hoop stress. Its solid `k = 1` line
is extrapolated linearly with temperature from the current FEA result. The
dashed `k = 0.5` line is one-half of that stress trend and is only an effective-
restraint sensitivity; it is not a separate FEA with a compliant bond. Both
lines mark their intersections with the 20 MPa bulk tensile-strength proxy.
Those intersections are comparison points, not predicted debond temperatures.

The comparison is not a validated failure criterion. FEA reports local maximum
principal stress, while the datasheet's 20 MPa value is a bulk uniaxial tensile
test. The present FEA enforces perfect displacement continuity across every
interface, so separation is impossible by construction. A separation-
temperature prediction requires cohesive interface elements or another
traction-separation law, with normal and shear adhesion strength or mode-I and
mode-II fracture energy for the actual epoxy-to-alumina and epoxy-to-copper
surface preparations. Residual cure stress and temperature-dependent
properties must then be included or bounded. Shear-driven separation is an
electrical concern even if it is not a bulk mechanical break: an opened
interface can form a void-like path where partial discharge or breakdown can
start.

The checked-in executable calculation and complete numeric output are:

- `software/bias_filter/thermal_stress.py`
- `simulations/thermal/outputs/default-thermal-stress.json`

## Axisymmetric thermal FEA

`software/bias_filter/thermal_fenicsx_solver.py` meshes the complete bonded
solid r-z half-section rather than the dielectric-only electrostatic domain.
It solves copper, alumina, epoxy, and the core using small-strain axisymmetric
linear elasticity. Cylindrical symmetry and the axial center-plane mirror
symmetry are exact for the idealized uniform stack. Exposed surfaces are
traction-free and all material interfaces are perfectly bonded.

The verified current default at 20 C gives 31.741 MPa P99 on a 0.30 mm,
9,276-cell mesh. Refining to 0.20 mm gives 31.800 MPa P99 on 21,538 cells;
the 0.10 mm, 79,254-cell reference gives 31.928 MPa. P95 and P99 remain stable
over the six-mesh campaign, while the raw material-corner peak rises from
40.612 MPa at 0.60 mm to 78.884 MPa at 0.10 mm and has not converged. Use P99
for design comparison and retain the raw value only as a mesh-sensitive
diagnostic.

The solve uses 70 C as the stress-free reference and applies a uniform
temperature change. The Designer's thermal mesh control sets the Gmsh target
element size; **Solve thermal FEA** calls `POST /api/thermal-solve` on the Pi
backend. Because this is a linear thermoelastic model, the presentation curve
scales the solved P99 result linearly with temperature difference.

The Designer viewer includes a **Thermal FEA** tab. The backend returns the
cell-center epoxy maximum-principal tensile stress from the solved half-stack;
the browser mirrors those points about the exact center plane to display the
complete stack. The color scale is capped at P99 so the bulk stress pattern
remains visible, while the raw mesh-sensitive peak is marked separately. The
default 0.30 mm solve returns 2,362 epoxy cell points in a roughly 75 kB JSON
response.

### Verification campaign

The full 2026-07-30 verification campaign is documented in
`docs/knowledge/thermal-fea-verification.md`. It includes:

- exact zero-temperature-change behavior;
- homogeneous free contraction;
- a 37 MPa fully restrained triaxial closed-form benchmark;
- exact temperature and common-modulus scaling;
- common-CTE-offset invariance;
- mirror-half versus independently meshed full-stack comparison; and
- 0.60 through 0.10 mm mesh convergence with saved field images.

All acceptance checks pass. The campaign also found and fixed an exact
zero-load UFL form-construction bug that did not affect nonzero-temperature
solves. Complete inputs and outputs are under
`simulations/thermal/validation/`.

The adjacent **FEA model regions** tab is not a literal geometric half-section.
It shows representative r-z material regions used by the cylindrically
symmetric FEA models; individual electrostatic solve regions may be reduced by
the selected exact-mirror or repeating-interior strategy.

The FEA does not include cure shrinkage, temperature-dependent properties,
viscoelastic stress relaxation, plasticity, voids, cohesive interfaces,
debonding, or fracture. It is a geometry-aware elastic comparison rather than
a mechanical qualification or failure prediction.

## Alternative potting materials

The candidate comparison and primary datasheets are recorded in
`docs/knowledge/epoxy-selection.md`. Flexible MG 832FX-family epoxies and
Epoxies Etc. 20-3241 may reduce bond stress, but their public datasheets do not
provide enough mechanical information to substitute them directly into this
FEA. Shore hardness is not Young's modulus and is not converted into one.

For a first-order comparison, restrained thermal stress scales as

```text
stress scale ~ E_epoxy * abs(alpha_epoxy - alpha_substrate) * delta_T
```

Consequently, a flexible epoxy can produce less stress than 9510 even if its
CTE mismatch is larger. The result depends on its much lower modulus,
temperature-dependent viscoelastic relaxation, cure shrinkage, and adhesion.
Those quantities need supplier data or measurements. Until then, the web
thermal solve is intentionally limited to MG 9510; other presets are valid for
electrical sensitivity studies only.

The low glass-transition temperatures of the flexible candidates change the
physical interpretation. Above Tg a cross-linked epoxy remains solid but is
more rubbery and viscoelastic, allowing creep and stress relaxation. Below Tg
it becomes glassier and stiffer, so contraction mismatch is more readily stored
as elastic stress. The transition is broad and rate-dependent, so these
materials require temperature-dependent modulus and relaxation data before
their separation behavior can be compared quantitatively with 9510.

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
resolved, the thermal analysis must not claim to include residual cure stress.

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

## Fitted-alumina thin-bondline study

The study in `simulations/thermal/alumina-insert-study/` compares the existing
bulk-epoxy model with a construction in which fitted machined alumina occupies
most regions that were epoxy. A specified epoxy clearance remains around every
core, washer, conductor plate, and tube profile. This is a mesh-resolved
material-layout comparison rather than final machinable CAD: each former
epoxy cell is assigned alumina when its centroid is farther than the clearance
from all solid profiles.

All cases use the default two-pair geometry, a 70 C stress-free reference, a
20 C evaluation temperature, exact axial mirror symmetry, perfect interfaces,
and the same linear elastic properties as the baseline. The 0.50, 0.30, and
0.20 mm bondlines use a 0.10 mm target mesh. The 0.10 mm bondline uses a
0.05 mm target mesh and 314,668 cells.

| Layout | Epoxy cell fraction of epoxy + alumina | P99 principal tension | P99 axial tension | P99 absolute r-z shear |
| --- | ---: | ---: | ---: | ---: |
| Bulk epoxy | 51.6% | 31.93 MPa | 29.53 MPa | 12.46 MPa |
| 0.50 mm bondline | 31.2% | 34.62 MPa | 32.76 MPa | 7.16 MPa |
| 0.30 mm bondline | 20.3% | 34.18 MPa | 33.52 MPa | 5.81 MPa |
| 0.20 mm bondline | 14.2% | 34.42 MPa | 33.91 MPa | 6.83 MPa |
| 0.10 mm bondline | 7.3% | 37.99 MPa | 36.60 MPa | 10.45 MPa |

The fitted alumina reduces epoxy volume and P99 shear for every tested
bondline, but it raises P99 principal tension by about 7% to 19%. The result is
consistent with stiff confinement: reducing free epoxy span does not guarantee
lower local tensile stress. The finest case also shows shear rising again,
which means the detailed bondline geometry and mesh need convergence checks
before interpreting a monotonic thickness trend.

This study does not determine separation temperature. The 20 MPa line is a
bulk 9510 tensile-strength proxy, not copper/alumina interface strength. A
cohesive-zone or fracture-energy model with measured thin-joint adhesion is
still required. Electrically, less bulk epoxy may reduce the volume available
for internal voids, but more fitted parts create more seams; the PD trade is
recorded in `docs/knowledge/partial-discharge-materials.md`.

Reproduction:

```bash
python3 software/bias_filter/thermal_alumina_insert_study.py
python3 software/bias_filter/plot_thermal_alumina_study.py
```

## Compliant and CTE-matched conductor presets

The thermal FEA provides independent plate and tube presets for 1050-O
aluminum, Grade 2 titanium, and Mo-Cu 65/35, 70/30, and 80/20. The aluminum
preset uses 69 GPa, 0.33, and 23.55 ppm/K for Young's modulus, assumed Poisson
ratio, and CTE. Its 28 n-ohm-m resistivity corresponds to about 61.6% of the
copper conductivity used here. The Grade 2 titanium preset uses
105 GPa, 0.34, and 8.6 ppm/K for Young's modulus, Poisson ratio, and CTE. The
Mo-Cu presets use the supplier's respective modulus/CTE pairs of 200 GPa/8.6,
210 GPa/8.2, and 220 GPa/6.3 ppm/K. Because the cited Mo-Cu sheet does not
publish Poisson ratio, all three currently use an explicit engineering
assumption of 0.30. Update that value from the purchased grade's data before
using the result for qualification.

This separation of plate and tube regions matters: a Mo-Cu or titanium plate
study can retain the readily available copper outer tube. Electrostatic FEA
still treats every conductor as an equipotential, while thermal FEA assigns
each region its selected elastic properties.

### Conductor and fitted-alumina campaign

The checked-in campaign in
`simulations/thermal/conductor-study/thermal-conductor-study.json` uses the
default geometry, a 70 to 20 C cooldown, exact mirror symmetry, a 0.10 mm
target mesh, and perfectly bonded interfaces. The primary comparison changes
the plates while retaining the practical copper tube. Each material is solved
with both bulk epoxy and the representative 0.30 mm fitted-alumina bondline.

| Plate material; copper tube retained | CTE (ppm/K) | Conductivity vs Cu | Bulk P99 tension | Bulk P99 shear | Fitted P99 tension | Fitted P99 shear |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Copper | 16.9 | 100% | 31.93 MPa | 12.46 MPa | 34.18 MPa | 5.81 MPa |
| 1050-O aluminum | 23.55 | 61.6% | 31.14 MPa | 12.21 MPa | 34.38 MPa | 7.41 MPa |
| Grade 2 titanium | 8.6 | 3.8% | 32.54 MPa | 12.97 MPa | 35.09 MPa | 5.51 MPa |
| Mo65Cu35 | 8.6 | 46.6% | 33.66 MPa | 13.25 MPa | 35.64 MPa | 5.36 MPa |
| Mo70Cu30 | 8.2 | 44.8% | 33.83 MPa | 13.30 MPa | 35.82 MPa | 5.44 MPa |
| Mo80Cu20 | 6.3 | 34.5% | 34.27 MPa | 13.46 MPa | 36.06 MPa | 5.72 MPa |

The important result is that matching the alumina CTE does not reduce the
epoxy P99 principal tension in this fully bonded geometry. With bulk epoxy,
Grade 2 titanium is the least disruptive alternative but still raises P99
tension by 1.9%; the Mo-Cu grades raise it by 5.4% to 7.3%. Mo70Cu30 matches
the nominal alumina CTE exactly, but its 210 GPa modulus makes the surrounding
assembly stiffer, and its P99 tension is 6.0% above copper. CTE alone is
therefore not a sufficient selection metric.

The fitted-alumina result is also a trade rather than a general stress
reduction. With copper conductors, the 0.30 mm layout reduces P99 absolute
r-z shear by 53.4%, from 12.46 to 5.81 MPa, but increases P99 principal
tension by 7.1%, from 31.93 to 34.18 MPa. CTE-matched plates reduce fitted-case
shear slightly further, while increasing principal tension. Replacing both
plates and tube does not reverse the conclusion: the fitted titanium and
Mo70Cu30 cases give 35.30 and 35.63 MPa P99 principal tension, respectively.

Electrical conductivity is recorded for the engineering trade but is not an
input to the thermoelastic solve. It also does not change the electrostatic
FEA, which treats each conductor as an equipotential. It can matter later for
contact behavior, RF skin loss, and damping in a full electromagnetic model.
Mo-Cu retains roughly 35% to 47% of copper conductivity, while Grade 2
titanium is about 3.8% of copper. Those differences do not create a thermal-
stress benefit in the present model.

Lower modulus plus a somewhat closer epoxy CTE does help the bulk-epoxy
layout modestly. Aluminum plates with the copper tube retained reduce P99
principal tension by 2.5%, from 31.93 to 31.14 MPa. Changing the tube as well
gives 31.01 MPa, a 2.9% reduction. This benefit does not carry over to the
fitted-alumina layout: all-aluminum metalwork gives 34.30 MPa P99 tension,
0.3% above copper, while P99 shear rises from 5.81 to 8.27 MPa. Aluminum is
therefore a useful bulk-potting candidate, not a general stress solution.

### Annealed-copper plasticity sensitivity

Two additional cases use incremental small-strain associative J2
elastic-perfectly-plastic copper. Yield strength is 69 MPa, corresponding to
the published 10 ksi 0.5%-extension yield for soft C11000 grain-size tempers;
hardening is zero because a certified purchased-product curve is not yet
available. Eight cooldown increments are used. The copper plate and tube
von Mises maxima return to 69.000 MPa, and a coarse four-versus-eight increment
check changed epoxy P99 tension by about 0.035%.

Matched-mesh linear copper references are required because the plastic cases
use 0.30 mm requested mesh in bulk epoxy and the fitted bondline cap refines
the other case to 0.15 mm. Relative to those references, plasticity changes
bulk P99 tension by -0.41% and shear by +0.35%. In fitted alumina it changes
tension by -0.003% and shear by +5.87%. Copper does yield in the idealized
model, but that yielding provides essentially no useful epoxy-tension relief.
Do not treat this as copper qualification: temper, prior cold work, cyclic
hardening, creep, and the actual stress-strain curve remain unmeasured inputs.

Reproduction:

```bash
python3 software/bias_filter/thermal_conductor_study.py
```

## Vacuum degassing

A long vacuum-degassing window is worth retaining as a prototype variable. It
can reduce entrained gas and therefore the initial void population that could
support partial discharge, but it does not directly reduce the elastic thermal
mismatch represented by this FEA. The stress model assumes fully dense epoxy,
perfect adhesion, no voids, and no cure evolution.

Record degassing duration, pressure, temperature, resin depth, observed
foaming, vacuum-release procedure, and delay before cure for each coupon.
Compare sectioned coupons and, preferably, partial-discharge inception rather
than treating elapsed vacuum time alone as proof of a void-free bond.

## Primary sources

- MG Chemicals 9510 TDS, version 5.2, 23 January 2026:
  https://mgchemicals.com/downloads/tds/tds-9510.pdf
- CoorsTek Advanced Alumina property table:
  https://www2.coorstek.com/media/4235/advanced-alumina.pdf
- Copper Development Association C11000 properties:
  https://alloys.copper.org/alloy/C11000
- Hydro EN AW-1050A properties:
  https://www.hydro.com/globalassets/08-about-hydro/hydro-worldwide/germany/extrusion-germany/alloy-data-sheets/hydro-en-aw-1050a.pdf
- Vishay MMB 0207 datasheet (alumina ceramic body and operating range):
  https://www.vishay.com/docs/28963/mmu0102_mma0204_mmb0207.pdf
- H.C. Starck Solutions Mo-Cu composite data:
  https://www.hcstarcksolutions.com/wp-content/uploads/PD-7101_1-MoCu-Composites.pdf
- Robert Laminage Grade 2 titanium data:
  https://www.robertlaminage.com/en/node/521
