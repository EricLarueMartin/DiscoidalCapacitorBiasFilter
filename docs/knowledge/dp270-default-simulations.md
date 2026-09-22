# DP270 default regeneration — 2026-09-22

The active default is three bias plates, 2 mm copper, 1 mm continuous DP270 gaps (εr=3.5), no distinct alumina washer, the existing 2.2 mm MELF core proxy, 10 MΩ stage/input resistance and 47 Ω output resistor. CAEN source network is 40 kΩ feeding 1 nF ∥ 300 MΩ before the 10 m input cable.

`software/bias_filter/run_dp270_default.py` regenerates electrostatic FEniCSx, ngspice/LMFE, thermal FEA, EQS and MEEP outputs. DP270 artifacts have `dp270` filenames; prior CAT23LV/CAT11 outputs retain their historical identities. Bundling verifies epoxy and geometry provenance as well as plate count and CAEN parameters.

Electrostatic peak: 7.61293 kV/mm at r=10.7 mm,z=5 mm under 6 kV. This is an ideal smooth/void-free axisymmetric result, not a partial-discharge qualification.

Thermal default: provisional 40→20 °C, E=3 GPa, ν=0.35. Piecewise DP270 CTE is 80/180 ppm/K at a 43 °C Tg onset; the FEA uses its integrated effective expansion over the selected interval. This retains constant elastic modulus and ignores relaxation/cure shrinkage. 40 °C has no verified full-cure duration. The 15209-cell, 0.3 mm target mesh gives epoxy tensile P99=11.79695 MPa and raw corner maximum=25.70740 MPa. Raw corner maxima are mesh sensitive. Closed form gives 6.62769 MPa against the MELF ceramic proxy and 5.82462 MPa against copper. The actual encapsulation/coating interface is unresolved. Published DP270 copper lap shear must not be used as a principal-tension limit; no bulk tensile safety factor is assigned.

The user plans to test low- and higher-temperature cures; curing above Tg is not by itself evidence of improved breakdown in this assembled geometry. Preserve cure schedule and coupon measurements when comparing results.

See `caen-hv-supply.md` and `simulations/spice/caen-dp270-50hz.json` for the pickup comparison.

## Validation limitations

The EQS conductivity, reciprocity, passivity and static-capacitance checks pass. Mesh refinement from 0.60→0.45→0.30 mm changes loaded transfer at 1 kHz by 0.00534 dB. EQS versus the independent electrostatic lumped matrix differs by 0.00830 dB at 50 Hz but 2.30899 dB at 100 kHz, exceeding the existing 2 dB criterion; the overall validation flag remains false.

The original MEEP residual tolerance 1e-4 produced a 21.815 dB EQS/MEEP overlap error. Repeating the shared points at 1e-8 gave −134.0193 dB at 300 MHz and −136.7942 dB at 1 GHz, reducing the overlap discrepancy to −2.7749 dB, still outside 2 dB. The tighter-tolerance full sweep is the published diagnostic; the raw convergence flag must not be confused with cross-model validation. No first resonance is verified by the five-point default sweep. The UI retains a failed-handoff label and dashed RF curve. No acceptance threshold was relaxed.
