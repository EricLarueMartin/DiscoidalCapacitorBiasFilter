# Degas Controller

Subproject for controlling the vacuum/pressure cycling used to reduce voids during epoxy potting.

## Prototype Function

- Control two valves through relays:
  - vacuum valve: opens the chamber to a vacuum pump.
  - pressure valve: opens the chamber to a pressure source, initially vent or nitrogen.
- Read chamber pressure from a pressure gauge or pressure transducer.
- Cycle between low-pressure and high-pressure dwell bands before heat cure.

## User Controls

- Low-pressure target.
- High-pressure target.
- Hysteresis band around each target for valve open/close control.
- Dwell time at each pressure band.
- Number of vacuum/pressure cycles.

## Notes

Pressure curing inside an oven could be useful later, but it is intentionally outside the first prototype scope. The first controller should focus on repeatable degas cycling at room temperature with clear valve-state logging and conservative pressure-vessel safety margins.
