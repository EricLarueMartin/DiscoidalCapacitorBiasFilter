# Digital Energy Shaping and Pole-Zero Correction

Designer / Noise now offers a joint energy-shaping switch, a pole-zero switch,
and an adjustable decay time. Shaping defaults on; PZ defaults off pending the
actual ADC firmware and configured decay coefficient. The provisional decay
time is 350 us = 1 Gohm * 0.35 pF, not a measured complete-amplifier time constant.

For sampling interval Ts, rise N samples and flat top F samples, the existing
shaper is the difference of two N-sample means separated by D=N+F samples:

    Htrap(z) = (1-z^-N)(1-z^-D) / (N(1-z^-1))
    a = exp(-Ts/tau)
    Hpz(z) = (1-a z^-1)/(1-z^-1)
    Htotal(z) = Htrap(z) Hpz(z)

The charge waveform is baseline-subtracted, PZ-corrected via
`y[n]=y[n-1]+x[n]-a*x[n-1]`, then shaped. The peak magnitude provides volts per
known detector charge. Every noise path uses the magnitude of the same total
transfer before RMS integration, divided by that same charge calibration.
With shaping off, both noise and signal use raw output, and PZ is bypassed.
The baseline subtraction defines the simulated pulse reference; it is not a
model of a continuously operating firmware baseline-restoration algorithm.

Pole-zero correction compensates preamplifier decay; it is NOT a mains notch.
For this model the combined DC limit is D(1-a), whereas the uncorrected
two-window difference has a DC zero. At the current reference settings the
assumed 10 mVpp 50 Hz supply sine contributes about 36.3 electrons RMS with
trap only, 290.2 with trap plus nominal PZ, and 2173.3 with shaping bypassed.
These are model comparisons, not a claim about the real ADC firmware. A
firmware baseline-restoration, high-pass, or other correction must be modeled
separately using its actual coefficients before claiming further suppression.

Background: [Jordanov et al., Digital techniques for real-time pulse shaping
in radiation measurements](https://deepblue.lib.umich.edu/items/b93485a3-7939-4bd5-9f19-95b4920290a6).

All switches and decay adjustments are browser post-processing only: they do
not invalidate FEA capacitances or SPICE transfers. Export/import includes them.
Tests check joint bypass, exact unit-height recovery from a synthetic decaying
pulse, and independent convolution of box(N), box(D), and [1,-a]/N versus the
frequency response at DC, 50 Hz, 1 kHz, and 17.321 kHz. Existing noise-source
isolation, scaling, and quadrature tests are retained.
