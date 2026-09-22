# Seven-plate default EQS and full-wave results

Requested 2026-09-22 because slides 19 and 20 correctly rejected the previous three-plate EQS/RF bundle after the default changed to seven plates.

The geometry is seven bias plates, copper, DP270 continuous epoxy without an alumina insert, 1 mm gaps and 2 mm plates. The full-wave job solves this entire axisymmetric geometry; electrostatic Cg/Cpar still use the existing reusable end/interior classes. The solver assumes rotational symmetry and sharp RF plate edges, and does not model the individual MELF spiral or non-axisymmetric leads.

Job: `c12a076da099473280b5281af29be8f7`. EQS points: 50 Hz, 1 kHz, 1 MHz, 31.25 MHz, 100 MHz, 300 MHz, 1 GHz. MEEP points: 300 MHz, 1 GHz, 3 GHz, 10 GHz, 30 GHz. Resolution: 2 cells/mm, CW tolerance: 1e-8. Resonance refinement is disabled in the defaults, so these points alone do not establish a verified resonance.

`build_default_bundles.py --full-wave <result.json>` updates the full-wave bundle independently of electrostatic, SPICE, and old three-plate validation outputs. Both raw result and completed backend job wrappers are accepted. Incomplete frequency sweeps are rejected; failed convergence/overlap checks are retained, not reclassified as passing. The browser checks the actual solved parameters before displaying the bundle.

`fullWaveKey` canonicalizes the backend defaults for free-space margin, PML, iteration limit, BiCGSTAB order, and resonance hints so explicit default values match omitted Designer values. Nondefault values remain part of the key. Rendering and parameter edits do not submit simulations.

## Completed results and memory

The full-wave/EQS job completed in 1544.74 s (25.75 min). Peak process-tree RSS was 563,101,696 bytes (537.02 MiB), sampled every 0.1 s. Process swap stayed at zero; lowest system available memory was 7,262,666,752 bytes (6.76 GiB). Existing system swap use is not evidence of solver swapping.

Four MEEP points converged to 1e-8: 300 MHz, 1 GHz, 3 GHz, and 10 GHz. The 30 GHz point exhausted 10,000 iterations with residual 1.70751e-5. It is retained in the saved diagnostics but excluded from the slide curve. The EQS/MEEP handoff residual is -14.76675 dB at 1 GHz after anchoring at 300 MHz, failing the 2 dB criterion. Slide 20 therefore shows RF diagnostic results, not a validated combined transfer prediction. No resonance is verified.

The companion seven-plate electrostatic job `f882d54d66a8466e87df6b67b6f2d126` completed in 305.381 s, peaking at 270,925,824 bytes (258.38 MiB) and zero process swap. It uses the selected end/interior symmetry approximation on the seven-plate model: end Cg 29.31153715 pF, interior Cg 29.34567442 pF, average adjacent Cpar 0.108560599 pF. Changing to another compatible plate count reuses those classes and only requires an explicit SPICE run for noise results. The default SPICE was explicitly rerun with this matrix: two-band supply 78.20568693 eV sigma versus Fano 831.46390071 eV sigma (0.09406); alternative 50 Hz supply scenario 45.18867965 eV sigma.

Saved outputs:
- `simulations/electromagnetic/default-dp270-seven-plate-full-wave.json`
- `simulations/axisymmetric/outputs/default-dp270-seven-plate-field.json`
- `simulations/spice/default-dp270-seven-plate-spice.json`

Each new backend field output retains `resource_usage`. On the Pi, historical records are appended to `simulations/axisymmetric/logs/fea-resource-usage.jsonl`. The old directly generated three-plate DP270 full-wave file has no resource record, so its peak memory cannot be reconstructed reliably. Earlier logged 45-minute five-plate full-wave timeouts peaked at 408-411 MiB without process swap.

Rebuild the electrical bundle with `build_default_bundles.py --electrical-only --field-job simulations/axisymmetric/outputs/default-dp270-seven-plate-field.json --spice simulations/spice/default-dp270-seven-plate-spice.json`. This checks that SPICE used the saved ground/mutual capacitance arrays, and leaves historical three-plate EQS validation fixtures intact.

Live verification: all default simulation-dependent slide graphics load, including EQS and RF. Slide 19 now scales both axes to its solved frequencies/attenuation, with an independent lumped RC comparison (maximum discrepancy about 0.51 dB). Slide 20 excludes the unconverged 30 GHz point and labels the failed handoff. A seven-to-five plate edit keeps end/interior FEA classes and requires only SPICE for noise, while separately flagging missing thermal/EQS/RF data. Buttons remain idle; browser error log is empty. Regression checks cover default bundle matching, geometry invalidation, plate/resistor reuse, noise scaling, and rejection of mismatched field/SPICE bundles.
