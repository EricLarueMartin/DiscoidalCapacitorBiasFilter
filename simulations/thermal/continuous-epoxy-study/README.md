# Continuous-epoxy gap thermal comparison

This study compares the default alumina-washer geometry with an otherwise
identical model in which the complete bias-to-ground gap is filled by the
selected potting epoxy. Both FEniCSx solves use the default 20 C evaluation
temperature, 70 C stress-free reference, 0.30 mm target mesh, exact mirror
symmetry, perfectly bonded interfaces, linear elasticity, and MG 9510 property
assumptions already used by the Designer.

The epoxy-gap mesh retains the former washer boundaries only as internal mesh
partitions. Both sides of those boundaries have identical epoxy properties;
there is no alumina material or bonded interface there. This keeps the two
meshes closely matched: 9,276 cells for the alumina baseline and 9,272 cells
for continuous epoxy.

| Epoxy stress statistic | Alumina washer | Continuous epoxy | Change |
|---|---:|---:|---:|
| Maximum-principal tension, P99 | 31.741 MPa | 27.208 MPa | -14.3% |
| Axial tension, P99 | 29.489 MPa | 21.054 MPa | -28.6% |
| Absolute r-z shear, P99 | 12.618 MPa | 13.675 MPa | +8.4% |
| von Mises, P99 | 24.671 MPa | 25.589 MPa | +3.7% |

The result supports the hypothesis that removing the rigid washer can reduce
principal and axial tension, but it does not remove thermal stress and slightly
raises the reported shear and distortion-energy measures. Raw corner maxima
remain mesh-sensitive and are not used for this comparison. Neither model has
a cohesive interface, cure shrinkage, viscoelastic relaxation, voids, solder,
or debonding, so neither predicts a separation temperature.

Files:

- `alumina-washer-baseline.json`: raw default FEniCSx result.
- `continuous-epoxy-gap.json`: raw linked-epoxy result.
- `continuous-epoxy-parameters.json`: input settings for the epoxy result.
