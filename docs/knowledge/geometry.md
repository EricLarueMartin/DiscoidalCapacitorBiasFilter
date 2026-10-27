# Geometry Notes

## Stack Elements

The filtering section uses two alternating plate types.

## High-Voltage Center Plate

- Connected to the center high-voltage path.
- In the web interface, its outside diameter is derived from the washer OD except in Custom relation mode.
- May include an inner hole in early prototypes to simplify construction.
- Outside edge is rounded.
- Outside diameter is smaller than the filter diameter, leaving space to grounded structure.

## Ground Plate

- Annular disc connected to the outer ground structure.
- Outside diameter is treated as equal to the derived tube inside diameter in the current web model.
- Inner diameter is derived from the washer ID except in Custom relation mode.
- Inner edge is rounded to reduce field enhancement.

## Ground Tube

The outer tube may connect or couple to the ground rings. Its presence, inside diameter, and input-output segmentation are design variables because they affect shielding, capacitance, and possible leakage paths.

## Web Parameterization

For a distinct ceramic washer, the primary assembly dimensions in the web designer are core OD, ground-tube ID, washer ID, washer OD, and washer thickness. Washer ID and OD remain editable in every relation mode and are the source dimensions for coupled plate geometry. Ground-plate OD equals the entered tube ID.

When the washer material is `epoxy`, there is no separate washer boundary. The Designer leaves washer ID, washer OD, and both relation controls visible but disabled so the inactive relationship remains understandable. Bias-plate OD and ground-plate ID become the editable primary dimensions, and the normalized solver geometry sets the displayed internal washer bounds equal to those plate dimensions so browser drawings, exported geometry, and FEA all receive the same continuous-epoxy region. Selecting a distinct washer material restores the normal washer-driven controls.

The washer ID relation has three modes:

- `ground_id`: `ground_plate_inner_diameter_mm = washer_id_mm`.
- `ground_flat_id`: `ground_plate_inner_diameter_mm = washer_id_mm - 2 * ground_edge_radius_mm`, so the washer begins where the rounded ground inner edge reaches the flat plate face.
- `custom`: ground-plate ID is edited independently.

The washer OD relation likewise has three modes:

- `bias_od`: `hv_plate_od_mm = washer_od_mm`.
- `bias_flat_od`: `hv_plate_od_mm = washer_od_mm + 2 * bias_edge_radius_mm`, so the washer ends where the rounded bias outer edge leaves the flat plate face.
- `custom`: bias-plate OD is edited independently.

The edge radii are calculated from each plate thickness and the edge-diameter percentage. Core-ground and bias-to-tube radial gaps are derived readouts:

- `core_to_ground_gap_mm = (ground_plate_inner_diameter_mm - core_od_mm) / 2`
- `hv_to_tube_gap_mm = (tube_id_mm - hv_plate_od_mm) / 2`

The promoted reference defaults use a 2.2 mm core OD, 26 mm tube ID, 1.0 mm continuous epoxy plate gaps, a 4.0 mm ground-plate ID, and a 23.0 mm bias-plate OD. With 2.0 mm plates and a 100% edge-diameter setting, this gives a 0.90 mm core-ground radial gap and a 1.50 mm bias-tube radial gap. No nominal washer ID or OD is retained for this all-epoxy geometry.

Bias and ground plate thickness controls allow values down to `0.0175 mm`, the nominal thickness of 1/2 oz copper foil. At this limit, rounded-edge radii derived as half the plate thickness become extremely small and peak-field results require correspondingly careful mesh convergence.

### Plate-Size Limits

Bias-plate OD has no fixed minimum and no required radial overlap with the ground plates. Its only lower limit is geometric: core OD + 2 x bias edge radius, so the rounded outer edge fits outside the core on both sides. With the 2.2 mm core and a 1.0 mm edge radius this is 4.2 mm. Bias plates smaller than the ground-plate ID (no overlap) are allowed; the analytic washer/overlap capacitance then goes to zero and only fringe coupling remains, so rely on the field solvers there. Ground-plate ID is limited to tube ID - 2 x ground edge radius so the ground annulus can hold its rounded inner edge. Distinct ceramic washers tied to both plates (`ground_id` / `bias_od` modes) still require a minimum washer radial width, which implies some overlap in those modes.

The earlier fixed 12 mm minimum bias-plate OD and 1 mm minimum radial overlap were arbitrary UI limits with no documented basis and were removed on 2026-10-27.

## Dielectric Regions

- High-permittivity dielectric is preferred between overlapping HV and ground plates.
- Lower-permittivity dielectric may be preferred near the core to reduce parasitic capacitance around the resistive element.
- Lower-permittivity dielectric may also be useful outside the overlap region, depending on fringe-field behavior.
- The physical washer is a flat annular slab between adjacent plate faces. It does not wrap into the small voids created by rounded conductor edges.
- The epoxy fill occupies the rounded-edge pockets and other non-washer dielectric regions. This is minor for the simple capacitance estimate, but the field solvers should use this z-dependent material boundary.
- Current working assumption: the simple capacitance model may still treat the washer as the overlap dielectric because the rounded-edge epoxy volume is a small correction. Field simulations should not use that simplification near edge-stress checks.
