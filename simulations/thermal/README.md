# Thermal analysis

`software/bias_filter/thermal_stress.py` evaluates the default cured copper,
alumina, and MG Chemicals 9510 assembly with a closed-form restrained-epoxy
model. Run it with:

```powershell
python software/bias_filter/thermal_stress.py
```

The checked-in result is `outputs/default-thermal-stress.json`. It preserves
the source material properties, assumed epoxy modulus range, equations,
geometry dimensions, a room-temperature evaluation point, and bulk-strength
sensitivity limits. The evaluation temperature is a what-if calculation
point, not a design target.

The closed form is an equibiaxial plane-stress baseline, not a conservative
bound. The separate FEniCSx model generally reports higher local
maximum-principal tensile stress because the actual geometry creates
three-direction confinement and stress gradients.

Run the complete thermal FEA verification campaign on a configured Pi with:

```bash
/usr/bin/python3 software/bias_filter/thermal_validation.py
```

Generate the saved result images with:

```bash
python software/bias_filter/plot_thermal_validation.py
```

The detailed methodology is in
`docs/knowledge/thermal-fea-verification.md`; the results, complete per-case
JSON files, and images are in `validation/`.

The fitted-alumina comparison is in `alumina-insert-study/`. It preserves the
production thermal geometry as its baseline and then replaces former
bulk-epoxy mesh cells with alumina outside 0.50, 0.30, 0.20, and 0.10 mm epoxy
clearances. The summary JSON, complete per-case solver outputs, and comparison
PNG are checked in so the slide values remain auditable. Reproduce it with:

```bash
/usr/bin/python3 software/bias_filter/thermal_alumina_insert_study.py
python software/bias_filter/plot_thermal_alumina_study.py
```

Neither calculation is an adhesive-fracture or thermal-cycle qualification.
The 9510 datasheet does not publish elastic modulus, copper/alumina pull-off
strength, or interface fracture toughness, and the FEA enforces perfect bonds.

The interactive solver also supports independent plate and tube assignments
for copper, Grade 2 titanium, Mo65Cu35, Mo70Cu30, and Mo80Cu20. Mo-Cu modulus,
CTE, and conductivity come from the cited supplier data; Poisson ratio is an
explicit 0.30 engineering assumption. Vacuum degassing is a fabrication
variable for reducing initial voids and is not represented by this linear
thermoelastic model.
