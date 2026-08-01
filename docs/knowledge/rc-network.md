# RC Network Estimate

## Purpose

The plate stack is an RC ladder. Each bias plate node sees capacitance to ground through the high-permittivity washer overlap, resistance to neighboring bias plates through the central resistive element, and unwanted parasitic capacitance to neighboring bias plates through the core material plus epoxy around the core.

The input and inter-stage bias resistances are high-value controls expressed in Mohm. The output series resistance is a separate ohm-valued control because the normal readout-side value is 50 ohms; the web app defaults it to 50 ohms and passes that value to both the browser and backend SPICE models without a megaohm conversion.

Manual numeric entries accept case-sensitive engineering prefixes with or without a space or trailing unit text: `T`, `G`, `M`, `k`, `m`, `u`/`µ`, `n`, `p`, and `f`. Thus `100M`, `100 M`, and `100 MOhm` all enter 100 Mohm in a resistance control, while `100f` enters 100 fF in a capacitance control. A value without a prefix remains in the control's displayed unit.

At high frequency, the resistor no longer sets the divider by itself. The ratio of bias-to-bias parasitic capacitance to bias-to-ground capacitance becomes an important feedthrough estimate.

## Web Estimates

The web interface uses simple parallel-plate formulas. These are first-pass circuit estimates, not field-extracted capacitances.

Single adjacent HV-ground gap capacitance:

```text
r_overlap_inner = max(washer_id, ground_plate_id) / 2
r_overlap_outer = min(washer_od, bias_plate_od) / 2
C_washer ~= epsilon0 epsr_washer pi (r_overlap_outer^2 - r_overlap_inner^2) / plate_gap
```

The washer is treated as a flat annular slab in the axial gaps between plate
faces. The entered washer ID and OD are the primary dielectric dimensions;
selected relation modes derive the ground plate ID and bias plate OD from them.
If a smaller Custom-mode washer is selected, the newly
exposed radial pockets are potting epoxy instead of washer dielectric. If a
larger custom washer is selected, only the portion overlapping both electrodes
contributes to the rough bias-to-ground capacitance estimate.

Single-stage bias-node capacitance to ground:

```text
C_g_stage ~= 2 C_washer
```

This is the capacitance from one bias plate to its two adjacent ground plates. It assumes the bias plate is between two ground plates, which is true for the interior bias nodes in the current stack.

Total two-terminal capacitance estimate:

```text
C_g_total ~= 2 N_pairs C_washer
```

This is the browser estimate for the capacitance from all HV plates/core to the grounded plates/tube when the whole HV conductor set is treated as one terminal. After a FEniCSx solve, the designer readout prefers the energy-extracted value:

```text
C_fea = 2 U / V^2
U = 1/2 integral 2 pi r epsilon0 epsilonr |grad V|^2 dr dz
```

An optional entered capacitor can be added equally from every bias plate to
ground. This circuit-only quantity is intended to test a matched symmetric set
of at least two discrete high-voltage capacitors, or another symmetric
shunt-capacitance structure not represented by the axisymmetric geometry. Zero
is the baseline design. A one-node result remains available as sensitivity
analysis, but it is not the intended physical construction:

```text
Cg,circuit,i = Cg,geometry,i + Cg,additional
Cg,circuit,total = sum_i Cg,circuit,i
```

Changing `Cg,additional` does not invalidate or rerun the electrostatic FEA.
The Designer continues to show geometric FEA `Cg` separately, and the complete
ladder and SPICE models use the summed circuit value. The FEA mutual matrix and
all adjacent `Cpar,i,j` values remain unchanged. The entered capacitor is ideal:
its package-to-package coupling, lead inductance, dielectric loss, leakage,
voltage coefficient, and voltage rating are not modeled. Those parasitics may
matter greatly for a real high-voltage implementation and should eventually be
added as separate elements when a part and layout are selected.

This remains a disfavored backup because dry encapsulation of HV capacitor
packages and terminations has previously produced discharge problems when
liquid potting was unavailable. Any physical implementation therefore requires
partial-discharge qualification of the complete symmetric assembly.

Adjacent bias-to-bias parasitic capacitance:

```text
d_hv_hv ~= plate_thickness + 2 plate_gap
C_parasitic ~= epsilon0 (epsr_core A_core + epsr_epoxy A_core_epoxy) / d_hv_hv
```

where:

```text
A_core = pi r_core^2
A_core_epoxy = pi (r_ground_inner^2 - r_core^2)
```

For ferrite-like bulk cores, `epsr_core` is the selected core permittivity. For MELF 0204/0207 presets, direct stage resistance remains a direct resistor value, but `Cpar` is no longer a fixed package placeholder. The app models the MELF body as a ceramic substrate with a metal-film fill-factor correction:

```text
epsr_core = epsr_substrate / (1 - FF)
```

The default 0207 model uses `epsr_substrate = 9.8` and `FF = 0.50`, giving `epsr_core = 19.6`. This is a first-draft effective-medium approximation for a high-value spiral-trimmed metal-film resistor. It avoids pretending the proprietary film path is known while still letting the capacitance scale with geometry. The old direct `Resistor Cpar` input remains available for non-MELF direct-stage models such as a deliberately lumped potted resistor chain.

For a ferrite core with conductive interleave discs, the app uses the analogous
one-dimensional effective-length model:

```text
R_stage = R_bulk * (1 - FF_conductor)
epsr_core,eff = epsr_ferrite / (1 - FF_conductor)
Cpar_core = Cpar_core,unfilled / (1 - FF_conductor)
```

The conductive fill defaults to zero. Direct stage resistance and direct Cpar
remain independent overrides, so the fill factor affects only the quantities
that are still calculated from ferrite geometry. This approximation is useful
for a parameter sweep but does not include disc-edge fringing, contact
resistance, or local field enhancement.

After a matching FEniCSx solve, the Designer tab reports the node-resolved
capacitance network used by SPICE. For each bias node `i`, a one-volt
single-node solve gives a unit basis field `phi_i`. Cross-energy integrals form
the Maxwell matrix directly:

```text
Cij = integral 2*pi*r*epsilon_0*epsilon_r
               grad(phi_i).grad(phi_j) dr dz
```

The physical mutual and node-to-ground capacitors are:

```text
Cpar,i,j = -Cij
Cg,i = Cii - sum(j != i) Cpar,i,j
```

This subtraction is essential. The energy from a basis solve with node `i` at
1 V and the other bias nodes at 0 V gives `Cii`, not `Cg,i`, because the
grounded bias nodes act as additional receiving electrodes. As an independent
check, the backend also solves a one-bias geometry and an exact-mirror
three-bias polarization model:

```text
Cg,one = 2 Uone / V^2
Cg,middle = (Cmiddle - Cneighbors + Call) / 2
```

The default Pi result is 39.915605 pF from the one-bias model and 39.774133 pF
from the corrected three-bias model. The uncorrected middle-only diagonal is
40.030002 pF and overcounts by 0.255868 pF, equal to two adjacent mutual
capacitances of 0.127934 pF each.

Exact reflected node fields are reused rather than solved again. The two-bias
matrix uses one node basis plus the all-bias check; the three-bias matrix uses
one end basis, the center basis, and the all-bias check. The reflected
potential participates directly in Maxwell cross-energy integrals, avoiding
the poorly conditioned subtraction of two roughly 40 pF energy results to
recover a roughly 0.128 pF mutual capacitance.

The core is dielectric with its selected effective permittivity, and the solid
bias-plate cross sections are the electrodes. These excitations cannot
generally use the peak-field solver's half-domain mesh
because their bias-plate voltages are not themselves mirror-symmetric. When
`Repeat interior FEA
cell` is unchecked, exactly reflected Maxwell entries are averaged. When it is
checked, the capacitance extraction additionally assumes that the two end bias
plates share one `Cg` class, every interior bias plate shares another, and
fully interior `Cpar,i,j` values depend only on axial plate separation.
End-involving pairs remain separate. For two bias plates, the repeating
constraint adds nothing and mirror symmetry gives exactly equal `Cg` values.

The final all-bias solve checks that the sum of the extracted `Cg,i` values
matches the two-terminal capacitance. The single-stage explanatory plot uses
the mean `Cg,i` and mean adjacent `Cpar,i,i+1`; the complete SPICE simulation
uses every expanded matrix element.

The complete FEA network is passed to ngspice. Every node receives its own
`Cg,i`, and every nonzero mutual `Cpar,i,j` is emitted as a capacitor between
the corresponding bias nodes. The displayed analytical `Cg` sanity check is
`2 C_washer`, directly comparable to one FEA bias node's `Cg,i`; the axial
parallel-plate `Cpar` remains a separate sanity comparison.

A 2026-07-30 Pi campaign checked `Cg` with one, two, three, four, and five bias
plates. Raw full-matrix values, exact reflection averaging, and
repeated-interior constraints agreed in mean to the displayed precision. The
largest full-to-mirror node correction was 0.0658%; the largest
repeat-to-mirror node change was 0.0460%. A separate one-bias exact-mirror
wide-disc sweep made the analytical two-washer approximation progressively
better: FEA/analytic decreased monotonically from 1.4486 at 12 mm OD to 1.0384
at 120 mm OD. The positive excess is finite-disc fringing. Full geometry and
results are recorded in `docs/knowledge/fenicsx-fea.md`.

Resistance between adjacent bias plates:

```text
A_core = pi r_core^2
R_total ~= rho_core stack_length / A_core
R_stage ~= rho_core (plate_thickness + 2 plate_gap) / A_core
```

`R_stage` uses the face-to-face bias-plate separation through the intervening gap, ground plate, and second gap. It intentionally excludes the bias-plate thickness because that section is shorted to the bias node.

In the web app, `rho_core` is entered in ohm-cm while geometry is in mm, so the implementation converts `L/A` as `(length_mm / 10) / (area_mm2 / 100)`.

When `Direct stage RC inputs` is enabled, the app instead shows a direct `Direct stage R` input. The total core-chain readout is then the entered stage resistance times the number of adjacent-bias stages, rather than a bulk-resistivity calculation from core geometry.

Stage corner estimate:

```text
f_stage ~= 1 / (2 pi R_stage C_g_stage)
```

High-frequency capacitive feedthrough indicator:

```text
feedthrough ~= C_parasitic / C_g_stage
```

Parasitic reactance takeover point:

```text
f_parasitic ~= 1 / (2 pi R_stage C_parasitic)
```

This marks the frequency where the adjacent-bias parasitic capacitance has the same reactance magnitude as the adjacent-bias ohmic path. Above this point, the resistor is no longer the dominant bias-to-bias path for AC noise, and the parasitic capacitance increasingly determines feedthrough.

Two-terminal shunt admittance estimate:

```text
G_load = I_load / V_bias
Y(f) = G_load + j 2 pi f C_g_total
```

The designer uses the load-current slider for `I_load`, defaulting to 1 nA. Before an FEA solve, `C_g_total` is the washer-overlap estimate above. After a matching FEniCSx solve, `C_g_total` is the energy-extracted capacitance from the solved geometry.

The web slide plots the ladder transfer as voltage-noise attenuation:

```text
attenuation_dB = -20 log10(|Vout / Vin|)
```

This uses the usual power-dB convention for equal impedances, so a factor-of-10 voltage-noise reduction is shown as 20 dB attenuation.

The displayed attenuation and SPICE-style ladder sweeps are intentionally limited to 1 Hz through 100 MHz. Power-line noise is the low-frequency feature that matters most here, so the plot starts far enough below 50/60 Hz to make the low-frequency rolloff clear without spending much visual space on slower drift. The high end is capped at 100 MHz because the DAQ sample rate is only around 200 MS/s, making higher-frequency response less useful for this design screen.

The designer tab reports the same single-stage attenuation values numerically:

- Attenuation at 50 Hz, calculated from the one-stage divider using `R_stage`, `C_g_stage`, and `C_parasitic`.
- High-frequency attenuation limit, calculated from the `C_parasitic / C_g_stage` feedthrough ratio.

The RC ladder slide also labels the 50 Hz attenuation point on the plotted transfer curve and draws the high-frequency attenuation ceiling implied by that same single-stage `C_parasitic / C_g_stage` ratio.

## Single-section validation and multiplication limit

For one isolated `R_stage`-`C_g_stage` section with no additional end
resistance or external load, the analytical divider and the full MNA/SPICE
solution are exactly the same. With the current default values at 50 Hz, both
give 0.0668998 dB. This is the limiting test that validates the individual
resistance and shunt-capacitance definitions.

That identity does not justify raising the one-section transfer function to a
stage count for the assembled filter. The physical ladder is unbuffered, so
downstream shunt capacitors load upstream nodes. The current section-count
comparison is still more aggressive because it applies the cable and detector
load to every multiplied section and counts every nonzero end resistance as a
full stage. The full ladder applies the external load once at the output.

The SPICE slide also includes a separate **full ladder unloaded** curve. This
retains the input series resistance, every internal stage resistance, every
stage-to-ground capacitance, and every adjacent-stage parasitic capacitance.
It removes load conductance, output-series current, cable, transmission line,
and detector capacitance, then measures voltage at the last filter node with
infinite input impedance. It therefore answers a different question from the
loaded detector curve: how much source voltage noise the filter itself removes
at its bare output terminal. For the default design at 50 Hz, the backend gives
about 0.45 dB unloaded versus 18.16 dB with the specified transmission-line
load.

At 50 Hz with the default loaded design, the multiplied and full-ladder results
diverge with stage count: 36.75 versus 18.16 dB for two bias stages, 73.51
versus 26.76 dB for five, and 134.76 versus 37.22 dB for ten. The apparent
two-to-one dB ratio at two stages is therefore coincidental rather than evidence
that the two washer capacitors were counted twice. Use the full ladder or
backend SPICE/MNA result for design conclusions.

The main loaded-ladder and SPICE slides therefore omit the multiplied-stage
curve. The electrical-model slide uses a one-section curve only to explain how
`R_stage`, `C_g`, and `C_parasitic` shape a single divider. The stage-count
divergence comparison is retained as a backup slide for questions about why the
one-section transfer cannot simply be raised to a power.

Washer dielectric comparison:

```text
C_gain_vs_FR4 ~= epsr_washer / 4.4
```

This is only valid for the simple parallel-plate washer-overlap estimate, but it is useful for estimating how much capacitance a better dielectric buys before sourcing or machining ceramic washers.

With the current browser defaults (`epsr_washer = 10` alumina-like, MELF 0207 direct-stage resistance, `epsr_core = 19.6` effective MELF core, 2.2 mm core OD, two bias plates and three ground plates, 6.6 mm washer ID, 20 mm washer OD, 1.5 mm washer thickness, and 26 mm tube ID), the estimate is roughly:

- `C_washer`: about 16.5 pF for one washer between one bias plate and one ground plate.
- `C_g_stage`: about 33.1 pF per bias plate.
- `C_parasitic`: about 0.26 pF between adjacent bias plates in the analytic/SPICE estimate.
- `FEA Cpar`: about 0.128 pF from the validated node-resolved Maxwell matrix.
- `R_stage`: 12 Mohm for the default 0207 direct stage.

The default capacitance estimates correspond to:

```text
C_washer ~= epsilon0 * 10 * pi * (10^2 - 3.3^2) / 1.5
C_g_stage ~= 2 C_washer
C_parasitic ~= epsilon0 * (19.6 * pi * 1.1^2 + 3.4 * pi * (2.55^2 - 1.1^2)) / 4.5
```

## Assumptions And Gaps

- Edge correction is ignored for capacitance.
- Outer tube capacitance is ignored in the circuit estimate; this is expected to be smaller when the washer overlap has much larger area and permittivity.
- The admittance readout is a quasi-static shunt estimate. It does not yet solve a lossy complex-permittivity FEM problem.
- The parasitic estimate focuses on the selected core/conductor material and epoxy around the core inside the ground-plate inner diameter.
- FR4/G10, alumina, zirconia/ZTA, and high-permittivity electroceramics can differ strongly in loss, leakage, voltage coefficient, microphonics, and practical surface finish; the RC estimate only uses `epsr`.
- A later FEA extraction should separately report washer capacitance to ground, tube/fringe capacitance to ground, and a true capacitance-matrix bias-to-bias parasitic capacitance.
