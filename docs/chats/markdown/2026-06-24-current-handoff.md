# Current Handoff: 2026-06-25

## Access From Home

The active host details are local deployment information and should be kept in an ignored `.secrets/` note, not in committed handoff docs. For a configured Pi, the expected endpoints are:

- Landing page: `http://PI_ADDRESS/`
- SHV Bias Filter app: `http://PI_ADDRESS/APP_PATH`
- Backend health: `http://PI_ADDRESS/api/health`

Pi paths:

- Project checkout: `PROJECT_DIR`
- Served static web app: `STATIC_DIR`
- Service: `SERVICE_NAME`

The Windows/OneDrive workspace remains the main shared working tree. The Pi has been synced with the latest web app, backend solver files, and markdown notes from the current session.

## Current Web App State

The designer page has:

- CAD mesh view generated from the same parameterized r-z profiles used by exports.
- Geometry half-section view.
- Electric-field view.
- Solver selector with browser JS fallback, backend finite difference, backend auto, and FEniCSx-required options.
- RC ladder estimates, including RC corner frequency, parasitic takeover where `|X_C,par| = R_stage`, single-stage attenuation at 50 Hz, and the high-frequency `C_par / C_g` attenuation limit.
- RF material placeholders for plate and tube material, defaulting to copper.
- Construction, simulation-focus, simulation-results, analytic edge-check, deformation, and RC slides.

The field plot uses conductor/equipotential colors:

- Red means HV equipotential conductor. This includes HV copper plates and the resistive/ferrite core, because the electrostatic solve holds the core at the bias voltage.
- Green means grounded conductor, including ground plates and the ground tube.
- Field colors in dielectric regions show electric-field magnitude on one absolute `V/mm` scale shared with the colorbar. Material breakdown values are shown as margin readouts/reference ticks, not as per-material color normalizers.

The headline field metric is now `Supported Emax`, not a raw single-node point maximum. The UI also shows the raw point maximum as a diagnostic and flags it when it is much larger than the neighborhood-supported value.

## Current Geometry Defaults

Important defaults:

- Bias voltage: 6 kV.
- Core diameter: 2 mm.
- HV plate OD: 20 mm.
- HV-to-tube radial gap: 2 mm, giving a derived tube ID and ground plate OD of 24 mm.
- Core-to-ground radial gap: 2.1 mm, giving a derived ground plate ID of 6.2 mm.
- Plate thickness: 1 mm.
- Washer thickness: 1 mm.
- Edge diameter: 100% of plate thickness, giving a 0.5 mm edge radius.
- Plate pairs: 2.
- Ground tube included.
- Plate and tube material: copper.
- Washer material: alumina.
- Epoxy fill material: MG Chemicals 9510 placeholder.

The editable outer radial source of truth is `HV OD`, not tube ID. Tube ID is derived as:

```text
tube_id_mm = hv_plate_od_mm + 2 * hv_to_tube_gap_mm
ground_plate_od_mm = tube_id_mm
```

## Dielectric Model

The capacitance model intentionally keeps the simple washer-overlap approximation.

The field solvers and cutaway view use the more physical material boundary:

- Washer material exists only as flat annular slabs in the axial gaps between adjacent plate faces.
- Epoxy fills the rounded-edge pockets, the core-adjacent gap, the tube-side gap, and all other non-washer voids.
- Flow holes and centering-ring flow paths remain omitted from the axisymmetric field solve.

This matters because the dominant rounded-edge field is often in epoxy, not in the ceramic washer.

## Current Solver State

Both the browser JavaScript fallback and Python finite-difference backend solve the cylindrical axisymmetric r-z electrostatic equation, not the rectangular-coordinate Laplacian. The finite-difference stencil includes radial face weighting.

The finite-difference solvers remain screening tools:

- They use a nonconformal structured r-z grid with deterministic local coordinate refinement.
- They include a near-conductor sliver guard to reduce false peaks from tiny intervals adjacent to fixed conductor nodes.
- They report a neighborhood-supported peak based on the 75th percentile of a same-material 3x3 dielectric neighborhood, plus the raw point maximum as a diagnostic.
- They verify the washer-overlap baseline well: default 6 kV and 1 mm axial washer gaps give about 6.0 kV/mm away from edges.

FEniCSx is implemented and installed on the Pi:

- Pi health reports `dolfinx 0.9.0`, `ufl 2024.2.0`, `mpi4py 4.0.3`, `petsc4py 3.22.4`, and `gmsh 4.13.1.dev1`.
- `FEniCSx required` jobs use a Gmsh/DOLFINx conforming axisymmetric r-z dielectric mesh with conductor regions removed as holes.
- The FEniCSx material expression also uses the flat-washer/epoxy-pocket dielectric map.
- The 2026-06-25 deployed FEniCSx boundary-marker fix uses a tiny geometric tolerance when tagging HV and ground Dirichlet faces. This fixed a missed-face bug where alternating flat washer gaps solved far below the expected `V / gap` field.
- Current deployed FEniCSx API check: with default 6 kV bias and 1 mm washer gaps, mid-gap overlap samples are `5999.99`, `6000.00`, `6000.00`, and `6000.00 V/mm`; supported/raw default peak is about `11.7 kV/mm`.

Do not use either FD or FEniCSx peak numbers as final dielectric-breakdown acceptance values yet. The next required work is a mesh-convergence loop that records edge-region element sizes, peak values, peak locations, and physical edge class.

## Pi Backend State

The Pi service currently runs on port 80 with requested/effective default solver `fd`. FEniCSx is available for explicit per-job requests.

The currently deployed web cache key is:

```text
app.js?v=2026-06-25-field-scale-and-fenics-bc
```

The backend accepts per-job solver requests:

- `fd`: Python finite-difference screening worker.
- `auto`: currently follows the backend's configured choice; with the service started as `fd`, it resolves to FD.
- `fenicsx`: explicitly requires the FEniCSx worker and should fail loudly if the optional path becomes unavailable.

The service health check is the authoritative quick status check:

```text
http://PI_ADDRESS/api/health
```

## Recommended Next Work

1. Add FEniCSx convergence studies.

   Refine rounded HV outer edges, rounded ground inner edges, and dielectric-interface endpoints until both peak value and peak physical edge class stop moving materially.

2. Keep finite-difference as a fast screen.

   Its main regression checks should be the washer overlap `V / gap`, field symmetry, and qualitative peak-location behavior. The same `V / gap` check is now mandatory for FEniCSx after any boundary-tagging, meshing, or material-map change. The supported peak is useful for trend feedback, not acceptance.

3. Add explicit benchmark cases.

   Start with parallel plates, coaxial cylinders, cylinder-plane, equal-clearance shell cases, and rounded-edge reference problems before trusting full-stack peak values.

4. Continue RF/quasi-static planning.

   The current RC plot is lumped. A later field-based frequency-domain comparison should solve:

   ```text
   div((sigma + j omega epsilon) grad(V)) = 0
   ```

5. Continue hardware construction planning.

   Current construction concept uses ferrite slices, polished copper discs, flat ceramic washers, centering/spacer features with epoxy flow paths, and heat-cured epoxy with vacuum/pressure degas cycling. The degas controller is a subproject under `hardware/degas-controller/`.

## Useful Files

- `README.md`
- `docs/knowledge/geometry.md`
- `docs/knowledge/simulation-plan.md`
- `docs/knowledge/resistor-voltage-stress.md`
- `docs/knowledge/pi-fea-backend.md`
- `docs/knowledge/fenicsx-fea.md`
- `docs/knowledge/edge-effects.md`
- `docs/chats/raw/2026-06-25-fenicsx-field-scale-and-boundary-tags.txt`
- `software/bias_filter/README.md`
- `software/bias_filter/axisymmetric_model.py`
- `software/bias_filter/field_backend.py`
- `software/bias_filter/fenicsx_solver.py`
- `presentations/web/index.html`
- `presentations/web/app.js`
- `deploy/pi/README.md`
