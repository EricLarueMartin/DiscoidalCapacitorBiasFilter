# Agent Guide: presentations/web

This directory contains static web presentation files.

Keep slides readable without a build step when practical. If a build system is added later, document it here and keep generated output separate from source.

`default.json` is installation-local and gitignored. It may contain either a raw settings object or the wrapped JSON produced by the Files panel. Load it before initial normalization and slide rendering, preserve built-in values for omitted keys, and keep browser-only startup functional when it is absent or invalid.
