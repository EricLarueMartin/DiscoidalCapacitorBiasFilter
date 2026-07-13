# Thermal mismatch screen

`software/bias_filter/thermal_stress.py` evaluates the default cured copper,
alumina, and MG Chemicals 9510 assembly with a closed-form restrained-epoxy
model. Run it with:

```powershell
python software/bias_filter/thermal_stress.py
```

The checked-in result is `outputs/default-thermal-stress.json`. It preserves
the source material properties, assumed epoxy modulus range, equations,
geometry dimensions, a room-temperature evaluation point, failure-onset
sensitivity limits, and interim transport guidance. The evaluation temperature
is a what-if calculation point, not a design target.

This is deliberately a conservative design screen. It is not an adhesive
fracture or thermal-cycle qualification because the 9510 datasheet does not
publish elastic modulus, copper/alumina pull-off strength, or interface
fracture toughness. The result therefore reports a full-restraint upper bound
and a 50% restraint sensitivity rather than hiding the uncertainty in a single
claimed rating.
