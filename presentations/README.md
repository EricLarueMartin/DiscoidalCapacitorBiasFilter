# Presentations

This section hosts web-based presentations and design views that can be viewed in a browser, version-controlled, and eventually published with GitHub Pages or another static site host.

Start with `web/index.html`. The page opens on the slide deck; the interactive geometry and electric-field Designer remains available as a tab. The slides render their geometry and browser-side simulation previews from the same startup settings as the Designer. The repository publishes this directory at `https://ericlaruemartin.github.io/DiscoidalCapacitorBiasFilter/` through GitHub Pages.

The deck uses a linked table of contents. Its six-slide **Main presentation** contains the title, a concise full-geometry-FEA-to-SPICE modeling chain, the complete-filter SPICE result, a detector-noise budget after the trapezoidal energy filter, the proposed reference design, and the recommended way forward. The bridge slide explains the low-frequency `Rstage-Cg` regime, the `Rstage-Cpar` bypass corner, and the high-frequency `Cg/Cpar` limit. The SPICE result overlays the loaded transmission-line case, the ordinary unloaded-output case, and the intrinsic direct-drive/open-output transfer used for comparison with the field solve. MELF and ferrite tradeoffs are grouped under **Engineering decisions**. Model definitions, detailed capacitance extraction, peak-field FEA, the matched open-circuit EQS/SPICE comparison, and resonance comparisons are grouped under **Models & FEA results**; detailed checks remain under **Validation & limiting cases**. Every entry is a URL fragment, so a specific slide can be bookmarked or linked directly. The contents rail stays at the left on larger screens and is collapsible above the slide on narrow screens.

The Designer's **Noise** tab exposes ADC rate, waveform length, trapezoid rise
and flat-top time, source-noise envelope, power-line frequency, measured
resolution, and Fano allocation. The slide propagates each source through the
loaded ladder and the exact discrete normalized-trapezoid transfer before
converting the residual through `Q = Cdet V`. The defaults use public LEGEND
anchors but remain assumptions until the production DSP configuration and
measured input-referred spectra are supplied.

The deck can be opened directly from `web/index.html`; its committed default-geometry FEniCSx field, exact capacitance extraction, ngspice sweep, and axisymmetric MEEP full-wave sweep are loaded through relative classic-script links that work under both `file://` and GitHub Pages. The optional installation-local `default.json` still requires HTTP. To test that file too, serve `web/` over HTTP—for example, run `python -m http.server 8000` there and open `http://localhost:8000/`. New backend FEA, SPICE, thermal, full-wave, and artifact features still require the project server.

Each deployment may put an untracked `default.json` beside `index.html`. At startup the page loads that file when present, using the same format accepted by **Import JSON**; otherwise it uses the built-in defaults. Choose settings in the Designer and use **Download default.json**, then copy the downloaded file beside `index.html` on that installation and reload. `default.json` is deliberately ignored by Git so one deployment's default does not change another's. **Reset** returns to the loaded installation default.

The engineering backup section includes the checked-in 1050-O aluminum and
annealed-copper thermal comparison. Aluminum modestly reduces bulk-epoxy
tension but does not help the fitted-alumina layout. The annealed-copper J2
case is explicitly a perfect-plastic sensitivity, with matched-mesh elastic
references, rather than a qualified material prediction.

The quasi-static electromagnetic slide combines the FEniCSx Maxwell capacitance matrix with geometry-derived partial inductance as an internal network check. The separate **Full-Field Noise Transmission to First Resonance** slide uses EQS from 50 Hz through a shared 1 GHz overlap point, then an overlap-normalized, convergence-audited cylindrical MEEP solve through the first bracketed candidate mode near 10 GHz. Its vertical scale is voltage-noise spectral-power attenuation, `-10 log10(Sout/Sin)`, numerically equal to `-20 log10|Vout/Vin|` for a common voltage-noise reference. The MEEP result is an `m = 0` symmetry reference, not final 3D validation: asymmetric leads, the MELF spiral, calibrated wave ports, and non-axisymmetric modes remain future work.
