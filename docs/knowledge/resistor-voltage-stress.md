# Resistor Voltage Stress

## Key Rule

Do not size the MELF or resistive-core path as if each resistor must withstand the full 6 kV detector-bias supply in steady state.

In this filter concept, detector current is normally below 1 nA, so the voltage across a series resistor is set by `I * R`, not by the full supply voltage. A 10 Mohm MELF at 1 nA drops about 10 mV; even 240 Mohm drops about 0.24 V. The high voltage mostly appears across dielectric clearances and capacitive structures, not along the intended bias resistor under normal load.

## What Still Matters

Resistor selection should still consider:

- Low noise and stability at very low current.
- Leakage, surface tracking, and potting compatibility.
- Pulse or surge robustness if a nearby dielectric breakdown dumps stored capacitance.
- Local electric-field enhancement at resistor end caps, solder joints, conductive epoxy, and nearby grounded conductors.

The relevant fault energy is usually capacitive:

```text
E_fault ~= 0.5 * C_fault * V_bias^2
```

For pF-scale capacitances at 6 kV this is typically in the microjoule to tens-of-microjoules range, but the actual coupled capacitance and discharge path must be estimated for the final geometry.

## Cross-Reference

If resistor voltage rating or "how many resistors are needed for 6 kV" comes up, start from this note first. Treat full-bias withstand as a dielectric/spacing and pulse-energy question unless the circuit topology actually places the full DC bias across the resistor string.
