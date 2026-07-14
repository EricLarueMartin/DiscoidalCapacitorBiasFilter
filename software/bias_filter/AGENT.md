# Agent Guide: software/bias_filter

This directory contains project-owned geometry and simulation utilities for the Discoidal Capacitor Bias Filter.

Keep command-line tools deterministic and tied to the parameter names in `hardware/geometry/default-parameters.json`. Scripts should write generated outputs to `simulations/axisymmetric/outputs/` unless a caller requests another path.
