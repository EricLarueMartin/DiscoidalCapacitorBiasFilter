# Agent Guide: SHV Bias Filter

This repository is intended to be readable and useful to AI coding, documentation, simulation, and design agents.

## Project Purpose

Develop a high-voltage, low-current bias filter initially for LEGEND-style detector biasing, but adaptable to other experiments. The baseline system uses SHV connectors, implying an initial practical voltage ceiling near 6 kV. Detector bias currents are expected to be sub-nA.

## Design Summary

The core concept is a cylindrical filter with alternating discoidal capacitor plates and a central resistive element:

- High-voltage plates connect to the center bias path.
- Ground plates are annular and couple to outer ground structure.
- The central core is a large resistance, approximately 100 Mohm to low Gohm.
- Plate edges are rounded to control electric-field enhancement.
- Dielectric choices matter: high permittivity is useful in the HV-to-ground overlap region, while lower permittivity is preferred around the resistive core and possibly the outer fringe region.
- Early prototypes may use NiZn ferrite as both structure and resistive element, but MELF resistor chains remain a likely alternate path if ferrite noise or stability is unacceptable.

## Working Rules

- Preserve raw collaboration records in `docs/chats/raw/`.
- Before ending a substantive session, update `docs/chats/raw/` with the user-facing conversation record or a clearly labeled reconstruction. Tool logs and routine intermediate steps are not required.
- Put distilled, durable knowledge in `docs/knowledge/`.
- Keep assumptions explicit, especially around dielectric properties, resistance, breakdown limits, connector ratings, and simulation boundaries.
- If resistor voltage stress comes up, read `docs/knowledge/resistor-voltage-stress.md` first; do not assume the bias resistor must withstand the full 6 kV DC supply in normal sub-nA operation.
- Prefer axisymmetric models when the geometry allows it.
- Treat values as provisional unless backed by calculation, datasheet, measurement, or simulation.
- When changing design intent, update both the relevant knowledge note and any affected presentation material.

## Important Parameters

- Core outside diameter.
- Tube inside diameter and ground plate outside diameter.
- HV plate outside diameter.
- Plate gap.
- Plate thickness.
- Edge radius, usually assumed to be half the plate thickness unless specified.
- Dielectric permittivity between overlapping plates.
- Dielectric permittivity outside the overlap region.
- Dielectric permittivity near the central core.
