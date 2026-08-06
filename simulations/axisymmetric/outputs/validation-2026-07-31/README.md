# Full Electrostatic Validation — 2026-07-31

Status: **all final acceptance gates passed**.

For the repeatable project-wide procedure, prerequisites, acceptance gates,
symmetry audit, deployed smoke checks, thermal campaign, browser checklist, and
failure handling, use the
[verification and validation runbook](../../../../docs/knowledge/validation-runbook.md).

This directory contains fresh FEniCSx results from the deployed Raspberry Pi,
not copied historical values. The six campaigns took approximately 18 minutes
10 seconds of Pi wall time in total and were run serially.

## Provenance

- Compute host: Raspberry Pi deployment used for validation
- Repository commit at run time: `119e2687942e7ba71e17084d1502e690a6593fe6`
- `fenicsx_solver.py` SHA-256: `0ddd193e4d005836f6d2ba4842c3ad38fe162b573d9bf6376a3c31d72b318102`
- `field_backend.py` SHA-256: `4b35b0b30b96f9d2dc7578004464c6090580817fdebf6293659ba9d5707b2dc1`
- `default-parameters.json` SHA-256: `4afc6e50392e8d2bc9e84f3d0851f3f11ba77ecd4bb1d77fb29b8b23925a6a65`
- DOLFINx 0.9.0, UFL 2024.2.0, mpi4py 4.0.3, petsc4py 3.22.4,
  Gmsh 4.13.1
- Local regression suite after the validation-harness changes: 44/44 passed.

The repository commit predates the working-tree solver changes, so the file
hashes are the authoritative solver provenance for these artifacts.

## Results

| Check | Final result | Status |
|---|---:|:---:|
| Receding-ground Cpar analytical limit | FEA/analytic increases monotonically 0.405 → 0.941 | Pass |
| Wide-disc Cpar analytical limit | FEA/analytic increases monotonically 0.720 → 0.949 | Pass |
| Wide-disc Cg analytical limit | FEA/analytic decreases monotonically 1.449 → 1.038 | Pass |
| Full vs exact-mirror adjacent Cpar | Average values agree to reported precision for 2–5 nodes | Pass |
| Full vs exact-mirror Cg | Maximum difference 0.0658% | Pass |
| Repeat allocation vs exact Cg | Maximum difference 0.0460% at five nodes | Diagnostic |
| Flat washer field, `E = V/g` | 666.666658 vs 666.666667 V/mm; error 1.25e-8 | Pass |
| Exact mirror peak | 5.60 V/mm difference; same HV-outer edge class | Pass |
| Exact mirror interior field map | Central-washer p99 error 0.0344% | Pass |
| Repeat field approximation | Peak error 0.809%; central-washer p99 error 0.0295% | Diagnostic |
| Rounded-edge mesh convergence | Finest-two peak change 1.862%; capacitance change 0.128% | Pass |

The global raw DG0 field-map comparison is retained in
`field-validation-suite.json` as a diagnostic. Pointwise gradients from two
independently generated P1 meshes are discontinuous across element boundaries,
so near-boundary DG0 differences are not used as the smooth-interior field-map
acceptance gate. Peak magnitude, physical edge class, energy/capacitance, and
central-washer interior samples are gated separately.

## Validation-harness defect found and fixed

The first fresh `--validate-cpar-gap-sweep` run produced the same normalized
geometry for every requested 2–50 mm gap. `normalize_parameters()` was deriving
the ground ID from the fixed washer/tube settings and silently overwrote the
sweep inputs. The harness now creates internally consistent custom-ID/custom-OD
geometries, expands the tube with the disc, records requested and normalized
gaps plus actual overlap, and has a regression test. The invalid first result
was overwritten; `cpar-gap-sweep.json` is the corrected run.

The initial four-level mesh convergence run also missed its peak gate by a
narrow margin (2.106% versus 2%). A fifth, finer 0.10 edge-radius-ratio case was
added. The new finest target is 0.075 mm, and the final two-level change is
1.862%; no tolerance was relaxed.

## Reproduction

```bash
python3 software/bias_filter/fenicsx_solver.py --validate-cpar-gap-sweep
python3 software/bias_filter/fenicsx_solver.py --validate-capacitance-strategies
python3 software/bias_filter/fenicsx_solver.py --validate-cg-strategies
python3 software/bias_filter/fenicsx_solver.py --validate-cpar-wide-disc-limit
python3 software/bias_filter/fenicsx_solver.py --validate-cg-wide-disc-limit
python3 software/bias_filter/fenicsx_solver.py --validate-field-suite
```

Each JSON file is paired with the shell timing output from its final run.
