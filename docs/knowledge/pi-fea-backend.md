# Pi FEA Backend Plan

## Design Goal

The web interface should keep quick design feedback in browser JavaScript while allowing the `Solve field` button to use a heavier Pi-hosted field solver when it is available.

## Multi-Client Rule

The Pi server can keep multiple clients straight if solves are treated as independent jobs. Do not make web requests write directly to shared `latest-*` output files, because two browser tabs or two people could overwrite each other's results.

Use a job ID as the authoritative handle:

- `POST /api/field-solve` accepts a parameter snapshot and returns either a completed result or a queued `job_id`.
- `GET /api/field-solve/{job_id}` returns queued, running, failed, or complete status.
- Each job stores its own immutable input parameters and result payload.
- The browser tracks the active `job_id` for that tab or request.

A browser-generated `client_id` is useful for logs and cleanup, but it should not be needed to recover correctness. The job ID is what prevents one client's result from being confused with another's.

## Browser Behavior

The web app should continue updating geometry, RC estimates, parasitic capacitance, and edge approximations locally in JavaScript.

When `Solve field` is pressed:

1. Try `POST /api/field-solve` with the current parameter snapshot and selected backend solver mode.
2. If the server returns a `job_id`, poll that job until completion or failure.
3. If the backend route is missing, unavailable, or fails early, use the in-browser finite-difference solver as a fallback.

This keeps the static page useful on a laptop while allowing a Pi or workstation to provide a stronger solve when attached.

Hosted endpoint details are deployment-local:

- Host address: `PI_ADDRESS`
- Project page: `http://PI_ADDRESS/APP_PATH`
- Health check: `http://PI_ADDRESS/api/health`
- Pi service: `SERVICE_NAME`
- Pi project checkout: `PROJECT_DIR`
- Served static directory: `STATIC_DIR`

Keep actual IP addresses, hostnames, paths, and service choices in ignored `.secrets/` notes.

The Designer solver selector is intentionally explicit:

- `Browser JS adaptive` runs the local JavaScript finite-difference screening solver in the browser.
- `Backend auto` sends `solver = auto`; on a host with the FEniCSx package stack and conforming worker ready, this can select FEniCSx. Keep an eye on the result `solverStatus` because the Pi service may still be started with `--solver fd` for conservative default behavior.
- `Backend adaptive FD` sends `solver = fd`; this means the Python backend answered the job, using the nonuniform/adaptive finite-difference screening worker.
- `FEniCSx required` sends `solver = fenicsx`; this requires the optional package stack and conforming FEA worker.

Do not describe `Backend adaptive FD` as FEniCSx or production FEM. It is better than the browser path for repeatability and server-side job handling, but it is still a screening solve.

The latest finite-difference worker includes a near-conductor sliver guard to reduce false maxima from tiny structured-grid intervals adjacent to conductor nodes. This improves display behavior, but it does not make the point maximum a design-acceptance number. If the reported peak moves when `grid_r_count`, `grid_z_count`, edge refinement, or solver iterations are tightened, that is a solver limitation, not a geometry conclusion.

The field-result contract now separates the supported design-screening peak from the raw point maximum. The supported value uses a same-material local-neighborhood filter to avoid isolated single-cell spikes dominating the UI. The raw point maximum remains in the payload for debugging mesh artifacts.

## Result Contract

The preferred result shape is the browser's current field-result shape:

```json
{
  "source": "fea-backend",
  "grid": {
    "nr": 76,
    "nz": 124,
    "dr": 0.293,
    "dz": 0.236,
    "bounds": { "zMin": -4, "zMax": 25, "rMax": 22 }
  },
  "field": [[0.0]],
  "maxField": 4474.6,
  "maxLocation": { "r": 5.17, "z": 14.93 },
  "rawMaxField": 4700.2,
  "rawMaxLocation": { "r": 5.16, "z": 14.92 },
  "peakQuality": {
    "method": "same-material 3x3 neighborhood p75",
    "rawToSupportedRatio": 1.05,
    "outlierSuspected": false
  },
  "iterations": 614,
  "lastDelta": 0.0099
}
```

For compatibility, the browser also accepts the current Python naming style, such as `max_field_v_per_mm`, `max_location_mm`, `iterations_run`, `last_delta_v`, and `grid.z_min`.

## Pi Server Implementation Notes

- A dependency-free staged implementation now lives at `software/bias_filter/field_backend.py`.
- It serves the web designer and implements `POST /api/field-solve`, `GET /api/field-solve/{job_id}`, and `GET /api/health`.
- The default worker uses the repository axisymmetric finite-difference screening solver and returns `source = fea-backend-axisymmetric-fd`.
- The current worker uses a nonuniform structured grid: deterministic refinement around rounded conductor edges, then a probe solve that adds midpoint coordinates around high-field dielectric nodes before the final relaxation pass. The browser draws the returned nonuniform cells directly.
- The FEniCSx worker builds a conforming Gmsh/DOLFINx r-z mesh with conductor regions removed from the dielectric domain. Use `--solver fd` for fast screening, `--solver auto` for automatic selection, and `--solver fenicsx` when deliberately requesting the optional FEA path.
- Both workers use the flat-washer/epoxy-pocket dielectric map: washer material only in axial gaps between adjacent plate faces, and epoxy in rounded-edge pockets and other non-washer voids.
- The FEniCSx boundary marker uses a small geometric tolerance when tagging HV and ground Dirichlet faces. This is required because Gmsh/DOLFINx boundary coordinates can land infinitesimally outside the ideal plate interval; exact classification missed one side of some plate faces before the 2026-06-25 fix.
- Keep the flat washer `E = V / gap` check as an API-level regression. For the default geometry, explicit `solver = fenicsx` should return about `6000 V/mm` at the radial and axial center of each 1 mm washer gap.
- Browser jobs may also pass top-level `solver` as `fd`, `auto`, or `fenicsx`. This per-job request is recorded in the job payload and result `solverStatus`.
- The FEniCSx worker should not be called production acceptance FEA until it has a mesh-convergence loop and records edge-region element size, refinement criteria, peak field, and peak location for each solve.
- The backend now records a symmetry plan in each result. The current worker still runs `full_stack` so the browser visualization grid matches the full geometry, but the future FEA worker should prefer exact `mirror_half` symmetry for ordinary stack solves.
- The mirror symmetry is exact for the idealized uniform stack, but the optimized code path still needs a same-geometry full-stack comparison as an implementation/regression check.
- Each completed FEA result should record mesh statistics, edge-region element size, refinement criteria, and convergence notes so peak-field numbers are traceable.
- Run a small queue, probably with concurrency 1 on a Raspberry Pi unless profiling shows otherwise.
- Store per-job outputs under a unique directory such as `simulations/axisymmetric/jobs/{job_id}/` or an application data directory on the Pi.
- Keep `latest-*` files for manual CLI runs and human-readable artifacts, not for web job identity.
- Validate and clamp incoming geometry parameters server-side before running a solver.
- Use a short timeout for accepting/enqueuing jobs, but allow long solve time through polling.
- Add TTL cleanup for old jobs.
- If the static page is served by the same Pi process, no CORS work is needed. If the page is opened from another host, explicitly configure allowed origins.
