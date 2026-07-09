# Prototype 0

## Purpose

First physical exploration of the discoidal bias-filter concept.

## Planned Simplifications

- Screw-terminal input and output.
- Parameterized plate stack rather than final connector integration.
- Candidate NiZn ferrite central resistive core.
- Rounded plate edges with radius initially equal to half the plate thickness.

## Candidate Materials

- Washer dielectric: alumina is the preferred first target; FR4/G10 remains the easiest fallback if suitable alumina washers are unavailable; piezoelectric high-permittivity electroceramics are screening-only and likely no-go because of microphonics.
- Potting and fill: MG Chemicals 9510 One-Part Epoxy Potting Compound, Heat Cure.
- Resistive core / conductor path: Fair-Rite type 61 NiZn ferrite is the first concrete sample set, tested with 4 mm, 5 mm, and 6 mm diameter samples. Keep the web model generic enough to compare other core material placeholders.
- Ferrite-to-plate contact: conductive epoxy, exact product TBD.
- Mechanical positioning: spacers with epoxy flow paths to hold the plate, washer, and ferrite-disc stack during cure and potting.

## Candidate Assembly Flow

- Cut ferrite samples into discs with a diamond saw.
- Polish discs to target thickness and inspect the edges and faces.
- Polish copper bias and ground discs before assembly.
- Bond ferrite or other core-material discs to bias plates with conductive epoxy.
- Use spacers with flow holes to maintain the intended plate spacing and alignment while allowing epoxy to fill around the stack.
- Add alumina washer dielectric sections in the HV-to-ground overlap regions if suitable washers can be sourced. Use FR4/G10 only as the fallback geometry/process prototype.
- Pot the assembly with MG Chemicals 9510.
- Vacuum degas with repeated vacuum and pressure cycles before heat cure. The pressure source may initially be vent or nitrogen.

## Degas Controller Need

Prototype potting will need a separate degas-controller subproject. The controller should drive two relay-switched valves: one from the chamber to the vacuum pump and one from the chamber to the pressure source. It should monitor chamber pressure and support user-set low pressure, high pressure, hysteresis band around each pressure target, dwell time at each band, and repeat count.

Pressure-cure integration in an oven could be useful later, but the first controller should focus on room-temperature vacuum/pressure cycling before heat cure.

## Measurements To Capture

- DC resistance.
- Leakage current versus voltage.
- Noise under representative detector-bias conditions.
- Breakdown or partial-discharge behavior if test equipment allows.
- Capacitance from HV path to ground.
- Parasitic capacitance between adjacent bias plates.
- Conductive-epoxy contact resistance.
- Resistance and leakage before and after potting and heat cure.
- Microscopy or visual inspection of cut and polished ferrite surfaces.
- Evidence of trapped voids, cracks, epoxy shrinkage, or partial-discharge damage.
- Capacitance improvement relative to FR4/G10 for alumina and any later non-piezo ceramic washer candidate.
- Dielectric loss, leakage, voltage coefficient, and microphonic response of any non-alumina high-permittivity washer candidate.
