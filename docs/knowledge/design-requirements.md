# Design Requirements

## Electrical

- Initial voltage envelope: up to about 6 kV for SHV-based versions.
- Detector current: typically sub-nA for LEGEND and similar detector bias applications.
- Series resistance target: approximately 100 Mohm to low Gohm.
- Filtering should reduce bias noise while avoiding excess parasitic capacitance around the resistive core.
- Track the RC ladder values: per plate-pair capacitance, per-node capacitance to ground, resistance between adjacent bias plates, and bias-to-bias parasitic capacitance.
- At high frequency, track the approximate capacitive feedthrough ratio `C_parasitic / C_ground`; see `rc-network.md`.
- Do not size bias-path resistors as if they must hold the full 6 kV DC supply in normal operation. Their steady drop is set by detector load current times resistance; see `resistor-voltage-stress.md`.
- Track capacitance improvement relative to FR4/G10 washers so the prototype can estimate the value of later ceramic washer upgrades.
- Prefer non-piezoelectric washer dielectrics; piezoelectric or ferroelectric high-K ceramics are likely unsuitable because detector-bias microphonics could matter.
- In the web interface, clearance-like geometry controls should use the selected washer material's provisional dielectric strength to set the minimum spacing and a 10x design-factor maximum. Custom or generic screening materials should use a fixed `0.4 mm` to `4 mm` range until backed by a specific material.

## Mechanical

- Cylindrical symmetry should be preserved where practical.
- Early prototypes may use screw terminals for input and output.
- Alumina washers are the preferred prototype dielectric if suitable parts can be sourced.
- Early prototypes may use FR4/G10 washers if ceramic washers are unavailable or too difficult to machine.
- Later prototypes should support direct connection to SHV bulkhead connectors.
- Ground rings should remain separable enough that an outer tube can adjust ground separation between input and output.

## Field Control

- Plate edges should be rounded.
- Initial edge-radius assumption: radius equals half the plate thickness.
- Simulations should focus on inner and outer rounded-edge regions.
- Dielectric boundaries should be included because field fringing may affect optimal material placement.

## Adaptability

The design should not be hard-coded to LEGEND. Parameters should allow alternate detector experiments, connector types, voltage limits, current ranges, dielectrics, and resistance strategies.
