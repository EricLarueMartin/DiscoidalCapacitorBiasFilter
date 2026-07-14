# Default-build thermal mismatch analysis

## Result

The default MG Chemicals 9510 / alumina / copper stack cannot be assigned a
credible subzero operating limit from datasheets alone. Two calculations are
kept side by side: a simple differential-contraction baseline and an
axisymmetric thermoelastic FEniCSx model of the bonded geometry.

The closed-form fully restrained baseline predicts that the epoxy-to-alumina
CTE difference controls:

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

Use +4 °C as the conservative closed-form onset-of-risk reference for the
present default geometry, not as a predicted fracture temperature. The broad
restraint and modulus sensitivity means the design has not earned a subzero
rating.

Until bonded-ring coupons establish a qualified cold limit, transport the
assembly at controlled room temperature, preferably at or above 25 °C, and
avoid unheated or freezing shipment. This is interim risk management rather
than a qualified transport-temperature rating.

## Closed-form baseline

Below the epoxy glass transition, the first-order equibiaxial estimate is:

```text
delta_epsilon = abs(alpha_epoxy - alpha_substrate) (Tg - T)
sigma = k E_epoxy delta_epsilon / (1 - nu_epoxy)
```

`k` is the effective restraint factor. `k = 1` is the fully restrained baseline
used for the default comparison. The first tensile-strength crossing is found
by setting `sigma` equal to 20 MPa. This calculation intentionally remains in
the project because it is transparent, fast, and independent of the FEA mesh.

### Basis of the stress equation

The baseline treats the epoxy as an isotropic layer with equal in-plane
principal stresses, `sigma_1 = sigma_2 = sigma`, and zero through-thickness
stress. Under plane stress, the elastic strain in either in-plane direction is

```text
epsilon_elastic = (sigma - nu sigma) / E = sigma (1 - nu) / E
```

Setting that elastic strain equal to the restrained differential thermal
strain gives

```text
sigma = k E delta_epsilon / (1 - nu)
```

This is the origin of the `1 / (1 - nu)` term. It is a uniform equibiaxial
restraint assumption, not a solution of the actual bonded-ring geometry. The
restraint factor `k` is an explicit sensitivity parameter; the FEA replaces
that assumed uniform restraint with displacement compatibility in the modeled
geometry.

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
delta_T_failure = strength * (1 - nu) / (k E delta_alpha)
T_onset = 70 C - delta_T_failure
```

For alumina, `E = 3000 MPa`, `nu = 0.35`, and `k = 1`:

```text
delta_T_failure = 20 * 0.65 / (1.0 * 3000 * 65.8e-6)
                = 65.8561 C
T_onset         = 70 - 65.8561 = 4.1439 C
```

The same calculation gives the documented sensitivity values:

| Assumption | Calculated onset |
| --- | ---: |
| `E = 2 GPa`, `k = 1` | -28.784 C |
| `E = 3 GPa`, `k = 1` | +4.144 C |
| `E = 4 GPa`, `k = 1` | +20.608 C |
| `E = 3 GPa`, `k = 0.5` | -61.712 C |

These crossings compare a calculated bulk epoxy stress with the published bulk
tensile strength. They are reference points, not predictions of interface
debonding or fracture temperature.

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

The default 0.30 mm thermal mesh at 20 C has 9,005 cells and reports 32.175 MPa
for the 99th percentile of epoxy cell-center maximum-principal tensile stress.
The raw material-corner peak is 53.254 MPa. Refining the target size to 0.20 mm
gives 21,006 cells, 32.115 MPa P99, and a 61.985 MPa raw peak. P99 changes by
only 0.19%, while the raw corner peak changes by 16.4%. Use P99 for design
comparison and retain the raw value only as a mesh-sensitive diagnostic.

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
as elastic stress. The transition is broad and rate-dependent. A provisional
flexible-epoxy build requirement is therefore a 20 C absolute minimum and a
preferred controlled minimum of 25 C for operation, unpowered storage, and
transport until coupons qualify lower temperatures. This gives some margin
above the 8.8 C Tg of 832FX and 12 C Tg of 832FXC, but little or no margin above
the 20 C Tg of 832FXT; 832FXT should be treated as a 25 C-minimum candidate at
this stage.

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

## Primary sources

- MG Chemicals 9510 TDS, version 5.2, 23 January 2026:
  https://mgchemicals.com/downloads/tds/tds-9510.pdf
- CoorsTek Advanced Alumina property table:
  https://www2.coorstek.com/media/4235/advanced-alumina.pdf
- Copper Development Association C11000 properties:
  https://alloys.copper.org/alloy/C11000
- Vishay MMB 0207 datasheet (alumina ceramic body and operating range):
  https://www.vishay.com/docs/28963/mmu0102_mma0204_mmb0207.pdf
