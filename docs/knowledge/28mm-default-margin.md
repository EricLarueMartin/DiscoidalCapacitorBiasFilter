# 28 mm shell default and Designer capacitance refresh

## Selected design

At 6 kV with DP270 (datasheet dielectric strength 850 V/mil = 33.4646 kV/mm), keep seven bias plates, copper bias/ground thicknesses 2 mm, axial gap 1 mm, core OD 2.2 mm, and shell ID/ground OD 28 mm. Select ground ID **4.2 mm** and bias OD **25.8 mm**, each on the requested 0.2 mm diameter grid. Core clearance is 1.0 mm radial and shell clearance 1.1 mm radial. The user's hard stop is 2 mm for either radial gap; no tested candidate exceeded it.

The selection maximizes plate overlap subject to a margin above four **including a 3% upward allowance on calculated peak field**. This allowance is an explicit conservative selection criterion, not a statistical error bar. A 4.0 mm ground ID gives about 4.02x nominal margin; 26.0 mm bias OD gives about 4.04x. Both lose the fourfold margin when the 3% allowance is applied. The selected neighboring 0.2 mm steps retain it.

## Numerical evidence

The default edge-mesh ratio changes from 0.2 to 0.05 (0.05 mm at a 1 mm edge radius). The core boundary retains gap/32 refinement. Rounded peak-field profiles have 64 segments per quarter-circle. Extra plotting samples now resolve the core surface, bias OD, ground ID, and plate-centre heights. The base plotting grid increases from 90 x 150 to 120 x 180. These plotting samples do not replace the finite-element mesh refinement.

End and interior fields were independently solved with uniform fine targets 0.05, 0.025 and 0.0125 mm, using coarse limits twice those sizes. The largest change in any checked critical region is below 1%; the finest global peak is 7.88165 kV/mm, giving 4.24589x nominal margin and 4.12222x with the 3% allowance. This is an observed mesh-convergence result, not proof of absolute physical error or material breakdown qualification.

A separate full seven-plate field-only solve has 348,126 cells and a raw peak of 7.83621 kV/mm. The mirror half-stack has 170,697 cells and 7.84276 kV/mm. The largest field is now at the bias OD; the 1.0 mm core radial clearance puts its peak below that. The model remains cylindrically symmetric with an equipotential core.

Reproduction:

```sh
python3 software/bias_filter/sweep_margin_geometry.py --output simulations/axisymmetric/outputs/28mm-margin-diameter-sweep.json
python3 software/bias_filter/sweep_margin_geometry.py --outer-boundary --ground-id 4.2 --output simulations/axisymmetric/outputs/28mm-margin-outer-boundary.json
python3 software/bias_filter/sweep_margin_geometry.py --verify --ground-id 4.2 --bias-od 25.8 --output simulations/axisymmetric/outputs/28mm-margin-convergence.json
```

The script refuses any gap above 2 mm. The checked-in convergence JSON includes the numerical acceptance summary.

## Designer refresh failure

The browser previously abandoned a field job after 120 seconds and, in Backend auto mode, silently launched the JavaScript screening solver. Actual recent FEniCSx default jobs took about five minutes; finer jobs take longer. The browser solver cannot extract the Maxwell Cg/Cpar network, so the real backend result never reached the Designer. The user's open Chrome tab also still contained the older seven-plate application build.

The browser now allows two hours including queuing; the refined FEniCSx backend budget increases from 15 minutes to one hour, displays elapsed job status, and never silently changes solver after a backend error. It clears the connection timeout once submission completes. Browser JS remains an explicit selection. Completed FEA results refresh Designer capacitances and all SPICE-dependent controls/views; stale SPICE results remain invalid until Run is pressed. Cg readouts retain two decimal places in pF, making small mesh-driven changes visible. Analytical comparison readouts remain explicitly labeled separately.

Tests cover successive distinct Cg/Cpar networks, invalidation of the old SPICE network, no automatic simulation requests, completion after more than two minutes, and explicit backend failure without a JS fallback. A local preview attaches to the real Pi FEA job to verify the same completion path in the browser without creating a duplicate job.

## Matching thermal and RF runs

The 28 mm default thermal FEA (40 C cure reference to 20 C) completed in 15.03 s with 37,040 cells, P99 tensile stress 10.7802 MPa and raw peak 25.2611 MPa. Peak process-tree RSS was 606,732,288 bytes; process swap was zero.

The matching EQS/full-wave job completed in 1,783.38 s with peak process-tree RSS 586,612,736 bytes and zero process swap. All sampled RF frequency points converged, but the independent EQS/RF handoff residual is -13.3397 dB, outside the 2 dB acceptance threshold. The presentation therefore retains the diagnostic/unvalidated handoff warning; solver convergence alone is not agreement between models.

## Boundary marker optimization

Before detailed conductor-boundary polygon tests, reject coordinates outside each conductor's bounding box expanded by the existing boundary tolerance. This changes neither the geometric predicate nor the mesh. The regression compares tags against the original predicate for randomized points, vertices, near-boundary offsets and segment midpoints, with and without the core dielectric. The original full unoptimized reference did not finish; the production-mesh lookup-equivalence check below validates the changed operations directly.

## Adaptive refinement versus the current solver

The user expected coarse-to-fine adaptive meshing with the coarse potential used as a fine-grid initial condition. The current FEniCSx path instead builds a geometry-graded, fixed mesh and uses PETSc preonly/LU. It has no solution-driven refinement or warm start. The under-3% acceptance evidence is a separate sequence of refinement runs, not an automatic in-solver error guarantee. The backend mesh-plan metadata and Designer tooltip now explicitly distinguish the implemented method from the planned adaptive loop.

The dominant refined-run overhead also included reconstruction of an identical mesh bounding-box search tree for every reflected boundary-point probe. Reflection now builds one immutable tree and reuses it for the initial lookup and all offset probes, preserving point order, offsets and first-colliding-cell selection. With both geometry-search improvements, the default run completed in 61.905 s at 501,022,720 bytes peak process-tree RSS with zero process swap. Its Designer sampled peak is 7.80108 kV/mm; the finer independent convergence study's 7.88165 kV/mm remains the conservative design-margin basis.

## Final validation and default outputs

On the actual 227,380-cell capacitance mesh, freshly built versus reused search trees selected identical first colliding cells for all 117,900 reflected degrees of freedom and 53,400 near-boundary probes (2,225 initially unlocated DOFs, eight directions at three distances). See `28mm-search-tree-equivalence.json`. The full unoptimized comparison was stopped after 2,259 s once this direct equivalence check passed; no completed whole-solver numerical comparison is claimed. The intermediate bounding-box-only API job hit its original 900 s server limit.

The seven-plate Maxwell network gives end Cg 37.073545 pF, interior Cg 37.101006 pF, total Cg 259.652120 pF, and adjacent Cpar 0.116993-0.116994 pF. The matching SPICE noise calculation gives supply 62.4786 eV sigma versus Fano 831.4639 eV sigma (7.51%), retaining the seven-plate design decision.

Validation: 88 Python tests pass; JavaScript tests cover capacitance reuse, field completion beyond two minutes, explicit failure without fallback, no automatic runs, all 37 slide graphics and 22 simulation-dependent renderers, and noise calculations. A browser replay of the actual completed solver result updated Designer Cg/Cpar and enabled manual SPICE. The packaged defaults loaded FEniCSx, SPICE, thermal and RF; changing seven plates to five retained FEA capacitance and replaced the noise graphic with a SPICE-run notice. Backend/display provenance for the standalone field export is explicitly FEniCSx.

## Minimum plate-count follow-up

The user requested six plates first, then five if six passes, to find the minimum below 10% of Fano. Reused the seven-plate FEA network with the exact Designer end/interior and coupling-distance reconstruction; no new FEA was run. A fresh six-plate SPICE simulation gives supply 95.6463 eV sigma / Fano 831.4639 eV sigma = 11.5034%, exceeding the 83.1464 eV sigma limit. The seven-plate result is 62.4786 eV sigma = 7.5143%. Therefore the descending search stops at six, retains seven as the minimum passing design, and does not run five under the user's conditional instruction. This is the two-band supply bound; the alternative 50 Hz-only scenarios are 52.8502 eV sigma for six and 42.0474 eV sigma for seven. Cable pickup remains a separate contribution. See `simulations/spice/28mm-minimum-plates-noise-study.json` and `software/bias_filter/study_minimum_plates.cjs` for reproducibility. The engineering decision slide records the six-versus-seven comparison.
