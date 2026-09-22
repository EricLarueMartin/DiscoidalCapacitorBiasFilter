# Editable Noise-Circuit Cables

Designer has a **Noise schematic** viewer tab beside the field-model viewers.
Four sections have independently editable length, R/m, L/m and C/m, and cable
presets. O1/O3 share the internal-cable settings; O2/O4 share the output-pair
settings. Source and load lengths remain linked to their Electrical controls.
Zero length bypasses a line; zero R is allowed; L and C must be positive.
Changes retain FEA capacitances but require a new SPICE solve. Existing saved
designs keep their original lossless input/HV lines until explicitly edited.
Cable edits wait for an explicit Run SPICE click. Browser testing exposed an
old 1.8-second SPICE request timeout; it is now ten minutes to accommodate the
full charge transient and sensitivity studies. The complete browser request
was verified to finish successfully with the flex output-pair preset.

| Preset | R ohm/m | L nH/m | C pF/m | Basis |
| --- | ---: | ---: | ---: | --- |
| LEGEND HV | 0.209 | 228 | 99.1 | User's LEGENDHVCable LTspice model |
| RG58 | 0.03281 | 262.5 | 93.5 | User's RG58 LTspice model; sqrt(L/C)=53.0 ohm |
| LEGEND LMFE Signal | 3.78 | 241 | 87 | User's SignalCable LTspice model |
| LEGEND Flex Signal | 1.92 | 307.5309 | 123.01236 | Provisional 50-ohm odd-mode approximation |

RG58 is a family; this preset deliberately reproduces the provided model, not
a universal manufacturer specification. All four presets can be edited.

## Flex Assumptions

The supplied MPIK180011H05_ULTRALONG KiCad file identifies Gerbview as its source.
It has front/back copper artwork but no fabrication stack-up establishing
copper thickness, dielectric spacing or effective permittivity. TOP.art contains
0.2 and 0.3 mm circular apertures; this does not independently establish the
user's approximate 0.25 mm signal width and 0.25 mm pair gap. Those remain input
assumptions, not dimensions extracted from a routed/net-assigned PCB model.

Assume 0.25 mm wide, 35 um thick room-temperature copper for R:
rho/(w*t) = 1.68e-8/(0.25e-3*35e-6) = 1.92 ohm/m per conductor.
At 10 m the differential loop resistance is consequently about 38.4 ohm.
Actual foil thickness and cryogenic resistivity must replace this assumption.

Assume effective relative permittivity 3.4 (fully filled Kapton approximation),
v=c/sqrt(3.4), and Zodd=50 ohm. Then Lodd=Zodd/v and Codd=1/(Zodd*v).
Air exposure and the actual stack-up can lower effective permittivity; this is
not an impedance calculation from trace width/gap. Bulk property reference:
[DuPont Kapton HN data sheet](https://www.beta.dupont.com/content/dam/electronics/amer/us/en/electronics/public/documents/en/EI-10206-Kapton-HN-Data-Sheet.pdf).

For balanced differential excitation the pair has Zdiff=2*Zodd=100 ohm,
Ldiff=2*Lodd and Cdiff=Codd/2. The editor displays odd-mode per-conductor L/C,
NOT 100 ohm for each conductor and NOT the actual conductor-to-ground partial
capacitance. Two identical single-ended LTRA half circuits reproduce this
differential-mode approximation. They do not establish common-mode impedance,
mode conversion, or crosstalk to adjacent pairs; these need mutual L/C matrices
or an extracted coupled-line model. The simplified amplifier is not guaranteed
perfectly balanced, so omitted common-mode behavior remains an uncertainty.

## Implementation and Validation

Explicit settings are in `noise_cables` in the exported design JSON. They feed
ngspice's distributed constant-RLC LTRA models; the emitted netlist embeds the
configured amplifier library, so artifacts retain the actual numbers used.
Frequency-dependent copper/skin loss and dielectric conductance are omitted.
The browser's simple lumped/analytical ladder remains a lossless-LC comparison;
use the actual SPICE curves for the entered cable resistance and amplifier paths.

Tests cover all three noise excitation paths, charge-pulse transient completion,
zero-length bypasses, invalid values, and preserving feedback before the output
cables. Numerical validation uses RG58 input, LEGEND HV output, the 1 m internal
SignalCable and a 10 m flex output pair. Results are saved to
`simulations/spice/configurable-cables-validation.json`.
