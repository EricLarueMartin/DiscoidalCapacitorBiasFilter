# Presentations

This section hosts web-based presentations and design views that can be viewed in a browser, version-controlled, and eventually published with GitHub Pages or another static site host.

Start with `web/index.html`. The first screen is an interactive geometry and electric-field design view, with slide material available as a tab. The slides render their geometry and browser-side simulation previews from the same startup settings as the Designer.

Serve `web/` over HTTP rather than opening it with a `file://` URL. For example, from `presentations/web/`, run `python -m http.server 8000` and open `http://localhost:8000/`. This also works from a static host such as GitHub Pages; backend-only FEA, SPICE, thermal, and artifact features still require the project server.

Each deployment may put an untracked `default.json` beside `index.html`. At startup the page loads that file when present, using the same format accepted by **Import JSON**; otherwise it uses the built-in defaults. Choose settings in the Designer and use **Download default.json**, then copy the downloaded file beside `index.html` on that installation and reload. `default.json` is deliberately ignored by Git so one deployment's default does not change another's. **Reset** returns to the loaded installation default.
