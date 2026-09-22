# Capacitance reuse for circuit sweeps

With Repeat interior FEA cell enabled, a matching source result with at least three bias plates supplies end and interior Cg plus mutual-capacitance distance classes. Counts of three or more reuse these classes without electrostatic FEA. Three remains the installation default and minimum useful representative stack. This is a repeated-cell circuit approximation, not exact mirror symmetry of a different finite stack.

Resistance, source impedance and load changes do not alter the electrostatic cache key. Geometry, gap/thickness/diameters and effective core/dielectric permittivity changes still invalidate it. Exact full-stack mode, one/two-plate results, thermal FEA, EQS and RF results retain their appropriate plate-count dependence. The plotted electrostatic field stays attached to the actual solved stack; the CAD geometry separately tracks the new count.

The reconstruction retains end Cg at both ends and inserts interior Cg for added plates. Adjacent Cpar is repeated, as are available mutual-distance classes. Source terminal-to-bias couplings are copied only from actual bias columns. The old terminal-to-terminal coupling is not treated as a further bias plate or blindly carried to a different stack length; unmeasured long-range terms are omitted and the network is labeled approximate. The source Maxwell matrix remains immutable.

## Circuit-only comparison, 2026-09-22

DP270, 10 MΩ interplate and input resistors, 47 Ω output, CAEN 40 kΩ/1 nF with 300 MΩ divider, 10 m source/load cables, 10 pF detector. Same saved three-plate FEA in every case. `simulations/spice/reused-stack-performance.json` preserves inputs, exported browser matrices, ngspice netlists and comparison samples. Independent Python MNA agrees with ngspice within 1e-4 relative complex error at 10,50,60,100,1000 Hz.

| Bias plates | Interplate resistors | Stage R | 50 Hz supply-to-detector attenuation | Intrinsic open-circuit attenuation |
|---:|---:|---:|---:|---:|
| 3 | 2 | 10 MΩ | 20.1468 dB | 0.25165 dB |
| 5 | 4 | 10 MΩ | 24.9285 dB | 2.04476 dB |
| 5 | 4 | 20 MΩ (input also 20 MΩ) | 31.6528 dB | 5.41839 dB |

At 50 Hz, 3→5 improves the complete loaded path by4.7817dB, or1.734× less transmitted voltage. Resistor count doubles internally but input/output elements and shared-node loading prevent simply squaring the whole transfer. The loaded metric is detector-node voltage, not the differential LMFE/energy response.

`node software/bias_filter/test_capacitance_reuse.cjs` validates plate-count and resistor cache behavior, geometry invalidation, matrix symmetry and row sums, terminal indexing and source immutability. An optional output filename exports the cases for `compare_reused_stacks.py` on the ngspice host.
