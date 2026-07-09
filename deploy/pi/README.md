# Raspberry Pi Web Host

This directory contains reusable Raspberry Pi hosting support for the SHV Bias Filter web app and solver backend. Keep site-specific hostnames, IP addresses, local checkout paths, passwords, and private keys in ignored local notes such as `.secrets/current-deployment.md`.

For a new Pi, the human should first complete the root README's Raspberry Pi Agent Bootstrap. After SSH as `codex` works, the setup agent should follow [agent-setup.md](agent-setup.md). Package details are split into [package-requirements.md](package-requirements.md).

## Layout

The agent setup guide uses these variables:

- `PROJECT_DIR` - repository checkout or synced working tree on the Pi.
- `STATIC_ROOT` - web server document root on the Pi.
- `APP_PATH` - URL path for the app, usually `/shv-bias-filter/`.
- `STATIC_DIR` - static files for the app, usually `STATIC_ROOT` plus `APP_PATH`.
- `SERVICE_NAME` - systemd service name.

The included service file contains placeholders. The setup agent must render it with the user's chosen `AGENT_USER`, `PROJECT_DIR`, and `STATIC_ROOT` before installing it.

## Service

`codex-sites.service` runs the repository's dependency-free Python field backend on port 80 as the agent user. It serves the landing page, the SHV Bias Filter web app, and `/api/field-solve` job endpoints. The service uses `AmbientCapabilities=CAP_NET_BIND_SERVICE` so it can bind port 80 without running as root.

The backend accepts `--solver fd`, `--solver auto`, and `--solver fenicsx`. The Pi package stack for FEniCSx/DOLFINx/Gmsh is installed and the conforming worker is implemented. The service is still intentionally started with requested/effective default solver `fd` so normal page loads use the faster screening path; use the web dropdown's `FEniCSx required` option when deliberately running the conforming FEA worker.

## Reporting Access

After setup, the agent must report the actual hostname or IP address it verified, using clickable links for the app and backend health endpoint. Do not commit those current-access details to this repository.
