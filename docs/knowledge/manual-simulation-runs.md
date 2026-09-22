# Manual simulation runs and slide validity

Updated 2026-09-22. Changing settings, opening slides, and rendering graphics must never submit field, SPICE, thermal, or full-wave jobs. Only their explicit run buttons submit jobs. CAD geometry assembly and closed-form analytical diagrams remain interactive; polling may reconnect to a full-wave job that the user already started.

`spiceLadderResultForCurrentDesign` is a read-only cache lookup. No bundled-reference fallback is used for current LMFE studies, and the reduced JS slide field solver has been removed. A field solve snapshots its submitted settings so subsequent edits cannot relabel its result. Repeated end/interior capacitance classes still permit plate-count and resistor changes without another electrostatic solve; changed plate count requires SPICE and thermal, and exact EQS/RF geometry must match.

`SLIDE_SIMULATION_REQUIREMENTS` gates every current-result graphic. Missing results replace the graphic with an accessible list of required simulations and their run-button locations. `SLIDE_REFERENCE_GRAPHICS` labels fixed historical studies; all other graphics are geometry or analytical. The comparison-FEA slide requires the optional two/three-plate comparison that a mirror/full-stack field run supplies. EQS plots use matching EQS samples from the full-wave job or a matching saved bundle, plus an independent lumped RC calculation using the current capacitance matrix. Old three-plate EQS/RF curves cannot substitute for the seven-plate default.

The seven-plate DP270 thermal FEA is now bundled: 34,385 cells at 0.3 mm, exact axial mirror, continuous epoxy (no alumina insert), 40 C stress-free reference to 20 C. P99 tensile stress 10.91957 MPa; raw corner maximum 24.68758 MPa. Constant modulus, perfect bonding, and no cure shrinkage/relaxation remain assumptions. No DP270 bulk tensile failure limit is assigned.

## Slide audit

| Slide | Data dependency / scope |
| --- | --- |
| Discoidal Capacitor Bias Filter | geometry / analytical (no solver job) |
| What Is Modeled | geometry / analytical (no solver job) |
| Electrical Model for SPICE Simulation | capacitance |
| SPICE Simulation of the Complete Filter | capacitance, spice |
| Detector Front-End Pickup Model | capacitance, spice |
| Three Noise Sources in the Complete SPICE Model | capacitance, spice |
| Simplified Amplifier SPICE Model | capacitance, spice |
| Detector Charge Sets the Energy Calibration | capacitance, spice |
| HV-Cable Pickup Transimpedance | capacitance, spice |
| Output Capacitance versus Energy Noise | capacitance, spice, capacitanceStudy |
| Output Resistance versus Energy Noise | capacitance, spice, resistanceStudy |
| Bias and Cable Noise After the Energy Filter | capacitance, spice |
| From Full-Geometry FEA to SPICE | capacitance, spice |
| Bias-to-Ground Capacitance from FEA | capacitance |
| Bias-to-Bias Parasitic Capacitance from FEA | capacitance |
| Peak Electric Field from FEA | field |
| Thermal FEA Model | thermal |
| Electroquasistatic FEA Checks the Distributed RC Model | capacitance, eqs |
| Full-Field Noise Transmission to First Resonance | capacitance, eqs, fullwave |
| From Damped Resonances to Field-Derived Transfer | capacitance |
| Using the Modeler | geometry / analytical (no solver job) |
| CAEN Output Network and 50 Hz Pickup | static explanation / explicitly saved reference |
| DP270 Default Thermal Screen | thermal |
| Seven Bias Plates Set the Supply-Noise Target | static explanation / engineering decision; current supply decision text is gated by field + SPICE |
| Ferrite and MELF Core Paths Considered | static explanation / explicitly saved reference |
| Verify the FEA Against Analytical and Limiting Cases | static explanation / explicitly saved reference |
| Continuous Epoxy Removes the Washer Seam | static explanation / explicitly saved reference |
| Avoid High-K Capacitors Without PD Qualification | static explanation / explicitly saved reference |
| Reference Design | fixed reference: Fixed earlier prototype geometry |
| Ferrite Offered Higher Resistance but Was Set Aside | fixed reference: Analytical earlier prototype comparison |
| Partial Discharge Is a System Property | static explanation / explicitly saved reference |
| Thin Epoxy Reduces Volume, Not Necessarily Local Stress | fixed reference: Saved alumina-insert thermal comparison |
| Soft Metal Helps Only the Bulk-Epoxy Layout | fixed reference: Saved conductor-material thermal comparison |
| CTE-Matched Metal Trades Tension for Lower Shear | static explanation / explicitly saved reference |
| Epoxy Choice | static explanation / explicitly saved reference |
| Why Ferrite Was Set Aside | static explanation / explicitly saved reference |
| One Section Matches; Stage Multiplication Does Not | geometry / analytical (no solver job) |
| Full, Mirror, and Repeated Models Agree | fixed reference: Saved full/mirror/repeated capacitance validation |
| Cpar Converges Toward the Axial Approximation | fixed reference: Saved parasitic-capacitance limiting-case study |
| Cg Matrix: Two vs Three Bias Plates | capacitance, cgComparison |
| Cg Matrix Treatments Agree | fixed reference: Saved ground-capacitance strategy validation |
| Cg Converges Toward Two Flat Washers | fixed reference: Saved ground-capacitance limiting-case study |
| The Limiting-Case Harness Needed Correction | fixed reference: Saved validation history |
| Total Capacitance Checks the FEA Scale | capacitance |
| Solvable Geometries Bound the Edge Field | geometry / analytical (no solver job) |
| Radius and Gap Set a Conservative Field Bound | geometry / analytical (no solver job) |
| Field-Limited Packing Has a Simple Shape Optimum | geometry / analytical (no solver job) |

Validation: `test_manual_simulations.cjs` checks all 37 graphics, current-result draw guards, explicit-only SPICE submission, thermal provenance, cache invalidation, and an independent two-node RC limit. Existing backend, thermal, capacitance-reuse, and noise-budget checks also apply.

Live verification: seven-plate thermal bundle loads with 10.92 MPa P99. Editing to five plates and 12 Mohm left SPICE idle and showed only the missing SPICE requirement while retaining FEA classes. Pressing Run SPICE restored the noise graphs; thermal remained unavailable for that changed stack. Changing the gap to 1.2 mm then required field FEA plus SPICE and thermal. Browser error log was empty. RF resolution changes invalidate full-wave bundles; transient sample-rate changes require SPICE, while shaping and mains-frequency post-processing reuse the electrical response.
