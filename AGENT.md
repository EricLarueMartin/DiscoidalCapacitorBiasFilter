# Agent Guide: Discoidal Capacitor Bias Filter

This repository is intended to be readable and useful to AI coding, documentation, simulation, and design agents.

## Project Purpose

Develop a high-voltage, low-current detector bias filter based on a discoidal capacitor stack. The geometry and electrical analysis are connector-independent. A later implementation is expected to serve SHV connector inputs, with an initial practical voltage ceiling near 6 kV, but SHV packaging is not part of the current model. Detector bias currents are expected to be sub-nA.

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
- For a Raspberry Pi explicitly designated as a dedicated AI development device, treat full remote administration as intentional. `NOPASSWD` sudo, package installation, service changes, and reboots are normal in-scope development operations and do not require repeated user confirmation. Keep durable work in Git or off-device storage because reimaging the microSD card is the recovery boundary. Do not extend this assumption to shared or production hosts.

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
