# Knowledge Overview

## Goal

Build a compact high-voltage bias filter around a discoidal capacitor stack for detector systems that need high bias voltage and very low current. The electrical and geometric analysis is connector-independent. A later implementation is expected to serve LEGEND-style SHV inputs and sub-nA detector currents.

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

The FEniCSx backend now reports a complete node-resolved capacitance network. One full-stack unit basis field is solved for each bias plate, and Maxwell cross-energy integrals directly provide every bias-to-bias mutual term and bias-to-ground row sum. An independent all-bias energy solve checks the total ground capacitance. MELF presets model the resistor body as a ceramic core with an effective metal-film fill factor rather than requiring a fixed package Cpar.

The deployed FEniCSx solver passed a five-level rounded-edge mesh-convergence check for the recorded default validation geometry: the two finest supported peaks differed by 1.862% and field-energy capacitance by 0.128%. The web UI reports a neighborhood-supported Emax and keeps the raw point maximum as a diagnostic. This verifies the numerical workflow for the tested geometry; it does not turn that peak into a dielectric-breakdown rating. Re-run a design-specific convergence sweep whenever geometry, materials, boundary conditions, or the physical peak edge changes. The complete procedure is in the [verification and validation runbook](validation-runbook.md).

The field-map color scale is absolute electric field in V/mm. Dielectric breakdown values are displayed as reference/margin information only, so color intensity should now correspond directly to the colorbar scale.

The web header includes a persistent language selector to the right of the
light/dark control. English, French, and German cover the application chrome,
major controls, viewer tabs, and presentation titles. The
`𒅴𒂠`/Sumerian choice is explicitly experimental: it uses cuneiform for a
small set of defensible navigation terms and leaves modern engineering
vocabulary in English instead of inventing unattested ancient terminology.
The South Carolina circa-1840 choice is a non-derogatory historical English
register, not a racial caricature. The selection is stored under
`discoidal-capacitor-bias-filter-language`.

Current Pi hostnames, IP addresses, checkout paths, and access URLs are deployment-local information. Keep them in ignored `.secrets/` notes and have the setup agent report the verified clickable URL after installation.
