# Geometry Notes

## Stack Elements

The filtering section uses two alternating plate types.

## High-Voltage Center Plate

- Connected to the center high-voltage path.
- In the web interface, defined directly by the high-voltage plate outside diameter.
- May include an inner hole in early prototypes to simplify construction.
- Outside edge is rounded.
- Outside diameter is smaller than the filter diameter, leaving space to grounded structure.

## Ground Plate

- Annular disc connected to the outer ground structure.
- Outside diameter is treated as equal to the derived tube inside diameter in the current web model.
- Inner diameter is derived from the core outside diameter plus the radial core-to-ground gap.
- Inner edge is rounded to reduce field enhancement.

## Ground Tube

The outer tube may connect or couple to the ground rings. Its presence, inside diameter, and input-output segmentation are design variables because they affect shielding, capacitance, and possible leakage paths.

## Web Parameterization

Use gap-style controls where one dimension is mechanically or electrically subordinate to another. The HV plate OD is the outer radial source of truth, with a 12 mm minimum in the current designer UI:

- `tube_id_mm = hv_plate_od_mm + 2 * hv_to_tube_gap_mm`
- `ground_plate_od_mm = tube_id_mm`
- `ground_plate_inner_diameter_mm = core_od_mm + 2 * core_to_ground_gap_mm`

The gaps are radial surface-to-surface clearances. Changing HV OD moves the high-voltage plate outer edge directly, while the tube ID and ground OD follow from the explicit HV-to-tube radial gap. Changing the core diameter moves the ground inner diameter through the explicit core-ground gap.

## Dielectric Regions

- High-permittivity dielectric is preferred between overlapping HV and ground plates.
- Lower-permittivity dielectric may be preferred near the core to reduce parasitic capacitance around the resistive element.
- Lower-permittivity dielectric may also be useful outside the overlap region, depending on fringe-field behavior.
- The physical washer is a flat annular slab between adjacent plate faces. It does not wrap into the small voids created by rounded conductor edges.
- The epoxy fill occupies the rounded-edge pockets and other non-washer dielectric regions. This is minor for the simple capacitance estimate, but the field solvers should use this z-dependent material boundary.
- Current working assumption: the simple capacitance model may still treat the washer as the overlap dielectric because the rounded-edge epoxy volume is a small correction. Field simulations should not use that simplification near edge-stress checks.
