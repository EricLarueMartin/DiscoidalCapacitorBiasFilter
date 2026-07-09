# Plate Stack Geometry

## Named Parameters

| Parameter | Meaning |
| --- | --- |
| `core_od` | Outside diameter of the central resistive core or HV path |
| `tube_id` | Inside diameter of the optional outer ground tube |
| `ground_plate_od` | Outside diameter of each ground-connected annular plate |
| `hv_plate_od` | Outside diameter of each high-voltage center plate |
| `washer_id` | Inner diameter of the ceramic washer slab; by default follows the ground plate ID |
| `washer_od` | Outer diameter of the ceramic washer slab; by default follows the HV plate OD |
| `plate_gap` | Axial gap between neighboring plates |
| `plate_thickness` | Axial thickness of each conductive plate |
| `edge_diameter_percent` | Web-control value for rounded-edge diameter as a percentage of `plate_thickness`; `100` gives radius `plate_thickness / 2` |
| `edge_radius` | Derived rounded-edge radius used by simulation/export code |
| `washer_epsr` | Relative permittivity of the flat washer slabs between adjacent plate faces |
| `epoxy_epsr` | Relative permittivity of epoxy fill in core-side gaps, tube-side gaps, regions outside the washer annulus, and other voids |

## Modeling Notes

The axisymmetric r-z model should represent rounded edges explicitly rather than approximating them as sharp corners. The first geometry cases should isolate local field behavior before modeling a full multi-section filter.

## Dielectric Regions

The working model separates these material zones:

- Ferrite or other resistive core material on the central high-voltage path. The electrostatic field solve treats this core as an HV equipotential body.
- Flat washer dielectric slabs in the axial gaps between adjacent plate faces, spanning from washer ID to washer OD. The defaults tie washer ID to ground plate ID and washer OD to HV plate OD.
- Epoxy fill in the core-side gaps, tube-side gaps, regions outside the washer annulus, and remaining volume.

For capacitance estimates, use the explicit washer ID/OD overlap. If a custom washer is smaller than the plate overlap, the exposed rounded-edge pockets are epoxy in the field material map.

HV plates may eventually include flow holes for vacuum degassing and epoxy fill. These are intentionally omitted from the initial axisymmetric electrostatic model because small azimuthal holes should have limited effect on the bulk axisymmetric field. A later 3D local study can check hole-edge field enhancement if the holes are large, numerous, or close to high-field regions.

The canonical starting parameter set lives in `default-parameters.json`.
