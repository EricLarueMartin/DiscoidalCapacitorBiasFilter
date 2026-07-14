# Bias Filter Tools

`axisymmetric_model.py` provides a lightweight parameterized model for early design iteration.

Examples:

```powershell
python software/bias_filter/axisymmetric_model.py export
python software/bias_filter/axisymmetric_model.py solve
python software/bias_filter/axisymmetric_model.py cad
```

The solver is a first-order finite-difference electrostatic model in an r-z cross-section. It is intended for trend finding, geometry review, and peak-field screening before higher-fidelity validation.

CAD exports are written to `hardware/geometry/generated/` as OpenSCAD, OBJ/MTL, and STL files. The CAD/mesh profiles use the same parameter interpretation as the axisymmetric solver.

## Pi Field Backend

`field_backend.py` stages the HTTP backend that the web designer already tries before falling back to browser JavaScript. It uses only Python's standard library so it can run on a Raspberry Pi without installing a web framework:

```powershell
python software/bias_filter/field_backend.py --host 0.0.0.0 --port 8765
```

Open `http://<pi-hostname-or-ip>:8765/` from the browser. The server exposes:

- `POST /api/field-solve`: accepts `{ "client_id": "...", "solver": "fd|auto|fenicsx", "parameters": { ... } }` and returns a queued `job_id`.
- `GET /api/field-solve/{job_id}`: returns queued, running, failed, or complete job state.
- `POST /api/geometry`: accepts `{ "parameters": { ... } }` and returns the sanitized solver-side r-z component profiles without running a field solve.
- `POST /api/spice-ladder`: accepts `{ "parameters": { ... } }` and returns a SPICE-style small-signal AC ladder sweep, generated netlist text, and summaries for the RC ladder plus coax transmission-line load.
- `POST /api/thermal-solve`: runs the axisymmetric linear-thermoelastic FEniCSx solid model synchronously and returns epoxy tensile-stress percentiles, the raw corner peak, mesh statistics, and model assumptions.
- `GET /api/health`: lightweight server status.

Jobs are independent and write under `simulations/axisymmetric/jobs/{job_id}/`, avoiding shared `latest-*` output files for browser requests. The default worker uses the repository finite-difference axisymmetric solver; explicit FEniCSx jobs run in a subprocess so Gmsh and PETSc are isolated from the web worker thread.

Every electric-field or thermal FEniCSx subprocess is sampled from Linux `/proc` at 0.1 s intervals. The solve tabs show peak solver-process RSS, peak system memory use, lowest available system memory, and maximum system swap use. The backend appends the complete sanitized inputs, solve status, mesh summary, full-stack/mirror/repeating-cell choices, process-tree RSS and swap, and system-memory extrema to `simulations/axisymmetric/logs/fea-resource-usage.jsonl`. This runtime log is intentionally ignored by Git; retain or analyze it on each Pi when developing hardware recommendations.

The first monitored default solves on a Raspberry Pi 5 used 156.5 MiB peak process RSS for the electric FEA and 251.8 MiB for the thermal FEA. Corresponding peak total system use was approximately 655 MiB and 771 MiB, with no swap use. The project therefore recommends 4 GB RAM for comfortable development and treats 2 GB as the practical minimum for the present single-worker service. Fine meshes and larger direct solves can require substantially more memory; continue using the accumulated runtime log rather than treating these first measurements as fixed upper bounds.

The backend has a staged solver selector:

```powershell
python software/bias_filter/field_backend.py --solver fd
python software/bias_filter/field_backend.py --solver auto
python software/bias_filter/field_backend.py --solver fenicsx
```

`fd` is the nonuniform finite-difference screening solver. `auto` may select FEniCSx when the optional package stack is installed and the solver reports ready. `fenicsx` deliberately requires that optional path and fails loudly when it is not ready.

The field backend is still electrostatic. Plate and tube conductivity/permeability parameters are passed through job inputs and summaries so a later frequency-domain admittance or RF backend can consume the same design payload, but the present `fd` solver treats conductors as equipotential boundaries.

The `/api/spice-ladder` endpoint is separate from the electrostatic field solve. On the deployed Pi it uses `ngspice` batch AC analysis when available, with an internal Python modified-nodal AC solve as a fallback for development machines without ngspice. The returned netlist uses ordinary SPICE concepts (`R`, `C`, and a lossless transmission-line `T` element), so the simulation can be inspected or rerun directly in ngspice.

The `/api/thermal-solve` endpoint is also separate from the electrostatic field solve. It meshes the full bonded copper/alumina/epoxy/core r-z solid and uses exact cylindrical and center-plane symmetry. The closed-form differential-contraction estimate remains in the web app as an independent baseline. The FEA assumes perfect bonds, traction-free exposed surfaces, linear elasticity, and a 70 C stress-free reference; it does not model cure shrinkage, relaxation, voids, or debonding.

The backend SPICE sweep and matching web attenuation plots are fixed at 1 Hz to 100 MHz. This makes the low-frequency rolloff around power-line noise easier to read while avoiding excessive very-slow-drift plot space, and 100 MHz is a practical upper view limit for the current detector readout context because the DAQ sample rate is only about 200 MS/s.

The web Designer exposes the same distinction as a dropdown: `Backend adaptive FD` means Python-backed finite difference, not FEniCSx. `FEniCSx required` is the explicit conforming FEA path.

The current `fd` worker solves the cylindrical axisymmetric r-z equation with radial face weighting, not the rectangular-coordinate Laplacian. It is still a nonconformal structured-grid solver. The point maximum near rounded conductor boundaries is labeled as a screening value because it remains mesh-sensitive; the overlap fields away from edges should be checked against `V / gap` and are the better regression sanity check until conforming FEA is available.

Both the FD and FEniCSx workers report a neighborhood-supported peak field plus the raw point maximum. Use the supported value for interactive screening and the raw point as a mesh-artifact diagnostic.

The current FEniCSx worker builds a conforming Gmsh/OpenCASCADE r-z dielectric domain with conductor regions removed as holes, solves the cylindrical weak form in DOLFINx, and samples `|grad(V)|` back onto the browser grid for comparison. It reports total two-terminal capacitance from the axisymmetric dielectric energy integral, `C = 2U/V^2`, and a quasi-static shunt admittance sweep using `Y(f) = Iload/Vbias + j 2 pi f C`. The load-current slider defaults to 1 nA.

The FEniCSx worker also reports an adjacent-bias `Cpar` estimate from a separate local three-bias-plate model. Three energy solves drive the middle plate, both neighbors, and all bias plates respectively; polarization then cancels ground-capacitance terms algebraically. This is an energy-based design sanity check, not yet a full capacitance-matrix charge extraction.

For MELF 0204/0207 presets, the Cpar solves include the inter-plate core as dielectric with an effective permittivity `eps_eff = eps_substrate / (1 - film_fill_factor)`. The default 0207 values are `eps_substrate = 9.8` and `film_fill_factor = 0.50`. In the capacitance-only geometry, each bias plate extends across the core cross-section as a stage-node electrode, but the core between plates remains dielectric. Adjacent-stage mutual capacitance uses three energy solves (middle only, neighbors only, and all bias plates) so polarization cancels capacitance to ground without assuming equal edge and middle ground capacitances. This remains an initial FEA backend, not yet a production acceptance calculation, because the peak-field convergence loop, mesh-refinement records, capacitance-matrix charge extraction, and lossy complex-permittivity FEM admittance solve still need to be added.

The analytic core-plus-epoxy Cpar estimate is intentionally a parallel-plate upper-level sanity check. It does not model field intercepted by the intervening ground-plate inner edge. When the ground-hole radius is comparable to or smaller than the adjacent-bias separation, FEA can therefore report materially less epoxy-mediated adjacent-stage coupling even after the core dielectric treatment is correct.

The Pi solver includes a repeatable Type 61 limiting-geometry comparison. It expands the core-ground radial gap while preserving radial plate overlap and reports FEA/analytic Cpar; that ratio should approach unity as the hole radius becomes large compared with stage spacing:

```bash
python3 software/bias_filter/fenicsx_solver.py --validate-cpar-gap-sweep
```

FEniCSx conductor boundary tagging uses a small geometric tolerance. This is required because Gmsh/DOLFINx boundary coordinates can land infinitesimally outside ideal plate intervals; exact classification previously missed one side of some conductor faces and produced washer-gap fields far below `V / gap`.

The field material model is z-dependent. Flat washer material exists only in the axial gaps between adjacent plate faces and between the explicit washer ID/OD. The defaults tie washer ID to ground plate ID and washer OD to HV plate OD; smaller custom washers leave the newly exposed radial pockets as epoxy.

Keep the flat-gap sanity check in any solver review: for default 6 kV bias and 1 mm washer thickness, samples in the radial and axial middle of each washer overlap should be about 6000 V/mm. The deployed Pi FEniCSx API passed this check on 2026-06-25.

Check optional FEniCSx dependency readiness with:

```powershell
python software/bias_filter/fenicsx_solver.py --json
```

Run backend tests with:

```powershell
python -m unittest software.bias_filter.test_field_backend
```
