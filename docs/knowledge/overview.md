# Knowledge Overview

## Goal

Build a compact high-voltage bias filter for detector systems that need high bias voltage and very low current. The first target is LEGEND-style detector biasing with SHV connectors and sub-nA detector currents.

## Baseline Architecture

The proposed filter is cylindrical and approximately axisymmetric. It combines:

- A center high-voltage path.
- A large series resistance.
- Alternating discoidal capacitive plates.
- Ground-connected annular plates.
- Dielectric regions chosen to shape capacitance and electric field.
- An optional outer grounded tube coupled to the ground rings.

## Development Priorities

1. Define geometry and safe electric-field margins.
2. Simulate rounded plate edges and dielectric transitions.
3. Prototype with simple screw-terminal input/output.
4. Evaluate NiZn ferrite as a resistive core.
5. Compare against a MELF resistor chain if ferrite noise, stability, or manufacturability is poor.
6. Evolve the mechanical interface toward direct SHV bulkhead connectors.

## Current Status

The web designer and Raspberry Pi backend are active enough for collaborative screening. The default deployed solver is an axisymmetric cylindrical finite-difference model with local structured-grid refinement. It gives sensible washer-overlap fields, including the default 6 kV across 1 mm result of about 6.0 kV/mm away from edges.

The optional FEniCSx backend now runs a conforming axisymmetric electrostatic solve on the Pi when `FEniCSx required` is selected. Both solver paths use the current physical dielectric interpretation: flat washer slabs only in axial gaps between plate faces, with epoxy filling rounded-edge pockets and other non-washer voids.

The current FEniCSx deployment has passed the simplest field-scale regression: default 6 kV bias across each 1 mm flat washer gap samples at about 6.0 kV/mm in the radial middle of the plate overlap. This check caught and fixed an early boundary-tagging bug, so keep it as the first sanity check after solver changes.

The FEniCSx backend now reports two capacitance sanity checks. Total HV-to-ground capacitance comes from the ordinary all-HV energy integral. Adjacent-bias parasitic capacitance is estimated with a separate local three-bias-plate solve and energy subtraction: middle bias plate driven, neighboring bias plates grounded, representative ground capacitance subtracted, then divided by two. MELF presets model the resistor body as a ceramic core with an effective metal-film fill factor rather than a fixed package Cpar.

The remaining unresolved simulation issue is peak-field convergence at rounded conductor edges. The web UI reports a neighborhood-supported Emax and keeps the raw point maximum as a diagnostic, but neither the finite-difference peak nor the initial FEniCSx peak should be used for dielectric-breakdown acceptance until a mesh-convergence loop is in place.

The field-map color scale is absolute electric field in V/mm. Dielectric breakdown values are displayed as reference/margin information only, so color intensity should now correspond directly to the colorbar scale.

Current Pi hostnames, IP addresses, checkout paths, and access URLs are deployment-local information. Keep them in ignored `.secrets/` notes and have the setup agent report the verified clickable URL after installation.
