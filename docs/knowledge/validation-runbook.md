# Verification and Validation Runbook

## Purpose

Use this runbook to verify that the web application, backend services,
electrostatic solvers, capacitance extraction, SPICE model, and thermal FEA are
working after a code, geometry, material, deployment, or dependency change.

This document separates three questions that must not be conflated:

1. **Software regression:** do functions and HTTP contracts still behave as
   implemented?
2. **Numerical verification:** do the FEA equations, boundary conditions,
   symmetry reductions, analytical limits, and mesh refinements behave as
   expected?
3. **Hardware validation:** does a manufactured, potted device survive voltage,
   thermal cycling, partial-discharge, and long-duration tests?

The first two are covered here. Passing them does **not** qualify a physical
design for high-voltage operation. Material breakdown data, voids, potting
quality, surface contamination, interfaces, cure stress, and manufacturing
variation remain separate hardware-validation responsibilities.

The last complete electrostatic campaign is recorded in
[`simulations/axisymmetric/outputs/validation-2026-07-31/`](../../simulations/axisymmetric/outputs/validation-2026-07-31/README.md).
The thermal campaign is recorded in
[`simulations/thermal/validation/`](../../simulations/thermal/validation/README.md).

## Which checks to run

| Change | Minimum required verification |
| --- | --- |
| Documentation only | Link/path check and `git diff --check` |
| Browser HTML, CSS, JavaScript, or translations | Local regressions, JavaScript/JSON syntax, manual browser checklist |
| Backend routing, queueing, deployment, or service configuration | Local regressions and complete deployed smoke test |
| Geometry normalization, conductor boundaries, dielectric map, meshing, field extraction, or peak filtering | Complete electrostatic campaign |
| Capacitance formulas, Maxwell extraction, SPICE network, mirror/repeat logic | Complete electrostatic campaign and SPICE smoke test |
| Thermal geometry, materials, loads, boundary conditions, or meshing | Complete thermal campaign |
| Dependency or operating-system upgrade | Local regressions, deployed smoke test, electrostatic campaign, and thermal campaign |
| Geometry selected for a design decision | Full-stack reference, exact-mirror comparison, and a design-specific mesh sweep in addition to the default regression campaign |

Never run the electrostatic and thermal campaigns simultaneously on the Pi.
The backend is deliberately configured for one FEA worker because direct
solvers can use memory superlinearly as meshes grow.

## 1. Record provenance before testing

Run from the repository root. Preserve this output beside the validation
artifacts:

```bash
git rev-parse HEAD
git status --short
sha256sum \
  software/bias_filter/fenicsx_solver.py \
  software/bias_filter/field_backend.py \
  software/bias_filter/thermal_stress.py \
  hardware/geometry/default-parameters.json
/usr/bin/python3 software/bias_filter/fenicsx_solver.py --json
```

The commit alone is insufficient when the working tree is modified. Record
file hashes for every solver used. FEniCSx readiness must report the backend as
available, implemented, and ready, with no missing modules.

Also record resource headroom:

```bash
free -h
df -h .
pgrep -af 'fenicsx_solver|thermal_validation|thermal_stress' || true
```

There should be no unexpected active solve. Do not begin if the Pi is already
swapping heavily or another FEA process is running.

## 2. Run local software regressions

On Windows with the configured Python runtime, or with ordinary `python` when
the environment is already correct:

```powershell
python -m py_compile `
  software/bias_filter/axisymmetric_model.py `
  software/bias_filter/field_backend.py `
  software/bias_filter/fenicsx_solver.py `
  software/bias_filter/spice_ladder.py `
  software/bias_filter/thermal_stress.py `
  software/bias_filter/thermal_validation.py

python -m unittest `
  software.bias_filter.test_field_backend `
  software.bias_filter.test_thermal_stress

node --check presentations/web/app.js
git diff --check
```

If `node` is not on `PATH`, use the Node executable supplied by the development
environment. In Codex desktop, ask the agent to resolve the bundled workspace
dependency path first. If no Node runtime is available, record the JavaScript
syntax check as not run and do not substitute that omission with an unrelated
Python test.

Validate JSON inputs and translations:

```powershell
python -c "import json,pathlib; files=list(pathlib.Path('hardware').rglob('*.json'))+list(pathlib.Path('presentations/web/locales').glob('*.json')); [json.load(p.open(encoding='utf-8')) for p in files]; print(f'valid JSON: {len(files)} files')"
```

Acceptance criteria:

- Python compilation succeeds.
- Every unit/integration test passes.
- JavaScript syntax and every checked JSON file parse successfully.
- `git diff --check` reports no whitespace errors.

## 3. Run the deployed service smoke test

The authoritative installation procedure and request examples are in
[`deploy/pi/agent-setup.md`](../../deploy/pi/agent-setup.md#5-smoke-test-the-service).
At minimum, verify from the Pi:

```bash
systemctl is-active SERVICE_NAME
curl -fsS http://127.0.0.1/api/health
curl -fsS http://127.0.0.1/APP_PATH/ | grep -i 'Discoidal Capacitor Bias Filter'
```

Replace `SERVICE_NAME` and `APP_PATH` with deployment-local values. Do not
commit hostnames, addresses, keys, or live deployment paths.

The health response must report:

- `status: ok`;
- requested and effective default solver;
- FEniCSx `available`, `implemented`, and `ready` all true on a FEniCSx host;
- thermal FEniCSx ready;
- no unexpected missing dependency.

Exercise each API path:

1. Submit and poll a small `solver: fd` field job until `complete`.
2. Submit and poll a one-bias-plate `solver: fenicsx` job until `complete`.
3. Call `/api/geometry` and confirm it returns normalized geometry.
4. Call `/api/spice-ladder`; require `status: ok`, finite results, and record
   whether the source is `ngspice-ac` or the internal modified-nodal fallback.
5. Call `/api/thermal-solve` only after field jobs finish; require finite stress,
   mesh metadata, assumptions, and resource data.
6. Confirm jobs have distinct IDs and one result never replaces another.

Afterward:

```bash
journalctl -u SERVICE_NAME -n 120 --no-pager
pgrep -af 'fenicsx_solver|thermal_stress' || true
free -h
```

There must be no crash traceback, orphaned solver, unexpected swap growth, or
stuck validation process.

## 4. Run the full electrostatic campaign

Run on a host with DOLFINx, Gmsh, PETSc, MPI, and the project checkout. Use a
new timestamped directory; never overwrite the last known-good record while a
new campaign is under investigation.

```bash
set -euo pipefail
cd /path/to/DiscoidalCapacitorBiasFilter
stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
out="simulations/axisymmetric/outputs/validation-$stamp"
mkdir -p "$out"

{ time /usr/bin/python3 software/bias_filter/fenicsx_solver.py --validate-cpar-gap-sweep > "$out/cpar-gap-sweep.json"; } 2> "$out/cpar-gap-sweep.time.txt"
{ time /usr/bin/python3 software/bias_filter/fenicsx_solver.py --validate-capacitance-strategies > "$out/capacitance-strategies.json"; } 2> "$out/capacitance-strategies.time.txt"
{ time /usr/bin/python3 software/bias_filter/fenicsx_solver.py --validate-cg-strategies > "$out/cg-strategies.json"; } 2> "$out/cg-strategies.time.txt"
{ time /usr/bin/python3 software/bias_filter/fenicsx_solver.py --validate-cpar-wide-disc-limit > "$out/cpar-wide-disc-limit.json"; } 2> "$out/cpar-wide-disc-limit.time.txt"
{ time /usr/bin/python3 software/bias_filter/fenicsx_solver.py --validate-cg-wide-disc-limit > "$out/cg-wide-disc-limit.json"; } 2> "$out/cg-wide-disc-limit.time.txt"
{ time /usr/bin/python3 software/bias_filter/fenicsx_solver.py --validate-field-suite > "$out/field-validation-suite.json"; } 2> "$out/field-validation-suite.time.txt"
```

On the 2026-07-31 Pi this took about 18 minutes. A zero-byte JSON file while a
process is CPU-bound is normal: JSON is emitted only at completion. Check CPU,
RSS, swap, and elapsed time before deciding that a solve is stuck.

### Electrostatic acceptance criteria

#### Cpar receding-ground sweep

- Each normalized gap equals its requested gap; duplicate normalized geometry
  is a validation-harness failure.
- `hole_radius_to_stage_spacing` increases.
- `fea_over_analytic` approaches 1 monotonically.
- The largest case is within 7% of the analytical limit.

The 2026-07-31 final ratio was 0.941. The first fresh attempt failed the
geometry check because normalization collapsed every gap to one geometry. That
defect is now regression-tested.

#### Cpar wide-disc limit

- `fea_over_analytic` approaches 1 monotonically as disc size increases.
- Left and right adjacent values agree for the symmetric three-node case.
- The largest case is within 6% of the analytical limit.

The 2026-07-31 final ratio was 0.949.

#### Cg wide-disc limit

- `fea_over_analytic` approaches 1 monotonically from above.
- Every case uses one bias plate and exact center-plane mirror symmetry.
- The largest case is within 5% of the analytical limit.

The 2026-07-31 final ratio was 1.038.

#### Capacitance strategy checks

- Full and exact-mirror average adjacent Cpar agree to numerical precision for
  two through five bias nodes.
- Full versus exact-mirror node Cg differs by no more than 0.1%.
- Repeat allocation versus exact-mirror node Cg differs by no more than 0.1%
  for the tested uniform stack, but remains an approximation.
- All capacitances are finite and nonnegative where physically required.

The last observed maxima were 0.0658% for full/mirror Cg and 0.0460% for
repeat/mirror Cg.

#### Field suite

Require all Boolean gates in `field-validation-suite.json` to pass:

- Flat washer median error from `E = V/g`: no more than 3%.
- Exact mirror peak: within 0.5% or 10 V/mm of full stack.
- Exact mirror physical peak radial edge class: identical to full stack.
- Exact mirror central-washer p99 pointwise field error: no more than 1%.
- Rounded-edge finest-two supported-peak change: no more than 2% or 10 V/mm.
- Rounded-edge field-energy capacitance change: no more than 1%.

The raw global DG0 map comparison is diagnostic. `|grad(V)|` is elementwise
discontinuous for P1 fields, and independent meshes can select different cell
gradients near boundaries. Preserve that metric, but gate smooth-interior
samples, peak, edge class, and energy separately.

The repeat-field result has no exact-symmetry pass gate. Record its error
against full stack and decide whether it is adequate for screening.

## 5. Symmetry-validity audit

Use a reduction only when both geometry and excitation preserve it.

| Treatment | Valid use | Invalid use |
| --- | --- | --- |
| `full_stack` | Reference for any implemented geometry/excitation | None; cost is the drawback |
| `mirror_half` field/total energy | Uniform stack with all bias conductors at one voltage, or another reflection-even excitation | Arbitrary single-node or differential excitation that is not even |
| Reflected basis reuse | Reuse a full-domain basis field for its exactly reflected partner | Treating an unpaired asymmetric basis field as a half-domain solve |
| `end_repeat_approx` | Equal-voltage all-bias field and total-capacitance screening of the uniform repeated stack | Maxwell basis fields, differential Cpar, nonuniform cells, asymmetric materials/voltages, or unique interior geometry |
| Thermal mirror half | Symmetric geometry, materials, temperature load, and boundary conditions | Asymmetric heating, material assignment, restraint, damage, or interface condition |

The fast repeat SPICE network is a screening allocation. Its node-ground values
are not Maxwell row sums, and adjacent Cpar is the local analytical screen, not
a mutual capacitance extracted from repeated all-bias FEA.

When symmetry is questionable, run `full_stack` and treat it as authoritative.

## 6. Run thermal verification

Run only after electrostatic work is idle:

```bash
cd /path/to/DiscoidalCapacitorBiasFilter
/usr/bin/python3 software/bias_filter/thermal_validation.py \
  --output-dir simulations/thermal/validation
```

Require `all_acceptance_checks_passed: true`. The campaign checks:

- zero temperature-change limit;
- homogeneous free expansion/contraction;
- closed-form fully restrained homogeneous stress;
- temperature linearity;
- common modulus scaling;
- common CTE-offset invariance;
- exact mirror/full-stack agreement;
- P95 and P99 convergence within 1% for the two finest meshes.

Regenerate plots separately if needed:

```bash
python software/bias_filter/plot_thermal_validation.py
```

These checks verify linear thermoelastic implementation under perfect bonds.
They do not validate adhesion, debonding, plasticity, cure shrinkage,
viscoelastic relaxation, cracking, or void growth.

## 7. Manual browser checklist

Open the deployed page in a fresh tab and verify:

- The page and all Designer/solver tabs load without console errors.
- The page opens on **Slides**, and the first default-geometry CAD drawing
  finishes rendering even when `/api/geometry` is unavailable.
- The control says **Bias plates**, defaults correctly, and permits values
  through 12.
- Geometry changes update CAD/material views and normalized values coherently.
- Right-clicking a field/material region opens its domain editor; double-click
  is not required.
- `Repeat interior FEA cell` is labeled as an approximation and is used only
  for equal-voltage screening.
- `FEniCSx required` reports FEniCSx provenance rather than silently using FD.
- Field and thermal solves are submitted sequentially and both complete.
- Potential, field, capacitance, SPICE, thermal, mesh, and resource summaries
  remain finite and internally consistent.
- Changing language does not break controls, plots, or layout.
- Refreshing does not show stale static assets from an older deploy.
- With no `presentations/web/default.json`, startup reports built-in defaults.
- With a valid installation-local `default.json`, startup reports that source,
  the Designer and first slide use its geometry, and **Reset** restores it.
- **Download default.json** produces a wrapped settings file that can be placed
  beside `index.html`; confirm it remains ignored by Git.

For a release or presentation, capture the default geometry, material map,
potential, field, capacitance network, SPICE response, thermal result, and
solver provenance.

## 8. Failure handling

If any check fails:

1. Preserve failing JSON, timings, inputs, hashes, versions, and resources.
2. Do not overwrite the last known-good artifact directory.
3. Identify whether the failure is solver, normalization, harness, deployment,
   or criterion related.
4. Add a regression test for every confirmed software or harness defect.
5. Rerun the failed check and every affected downstream check.
6. Do not relax a tolerance merely to make a result pass. If a criterion tests
   the wrong behavior, document why, retain the old diagnostic, and replace it
   with a metric that tests the intended behavior directly.
7. Report partial success as partial success.

Stop a solve before out-of-memory only when resource trends justify it, and
record the aborted case. High CPU with stable memory and zero swap usually means
the solver is busy, not deadlocked.

## 9. Final validation record

Every campaign should include:

- date/time and operator/agent;
- commit plus solver hashes;
- dependency versions;
- normalized geometry and materials;
- solver and symmetry strategy;
- acceptance metrics and Boolean results;
- mesh targets and physical peak edge class;
- wall time, peak RSS, minimum available memory, and swap use;
- failure/fix history;
- links to raw artifacts;
- an explicit statement of what was **not** validated.

Use scoped language: “all electrostatic code-verification gates passed for the
recorded default and limiting geometries.” Do not shorten that to “the
high-voltage design is safe.”
