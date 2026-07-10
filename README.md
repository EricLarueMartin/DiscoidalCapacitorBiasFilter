# SHV Bias Filter

This repository contains the design, simulation, prototyping, and presentation tools for a high-voltage, low-current detector bias filter. The project was developed around an AI-managed Raspberry Pi: the AI works from your computer, connects to the Pi over SSH, installs the solver stack, hosts the web interface, and tests the deployment.

## What You Need

The recommended setup is:

- A Raspberry Pi 5 with 8 GB RAM. A Pi 4 with at least 4 GB should also be usable, but finite-element solves will be slower.
- A 64 GB high-endurance microSD card. A 32 GB card is a practical minimum.
- The correct Raspberry Pi power supply.
- Ethernet or Wi-Fi access to the same network as your computer, with Internet access during installation.
- A Windows, macOS, or Linux computer from which an AI coding agent can edit this repository and connect to the Pi by SSH.
- A microSD card reader for installing Raspberry Pi OS.

A monitor and keyboard for the Pi are optional. Raspberry Pi Imager can preconfigure the network and SSH, and Raspberry Pi Connect is a useful fallback during initial setup.

If you already have a suitable Pi running on your network, use it; the agent runbook begins by discovering what is already complete and skips unnecessary setup.

Setting up a Pi is worthwhile beyond this one project. Once provisioned, it becomes a reusable development and test environment for other web services, simulations, instruments, and automation projects. It can communicate over Wi-Fi, run without a monitor or keyboard, and be placed wherever it is convenient for the work at hand while your AI agent continues to control it remotely over SSH.

The recommended trust model is to treat the Pi as an AI development appliance rather than a durable server. Give the dedicated AI account full administrative control, including `NOPASSWD` sudo, so the agent can install packages, change services, reboot, and repair the environment without repeatedly stopping for authorization. Keep source and important results in Git or another external location. If the agent damages the operating system beyond convenient repair, reimaging the microSD card provides a clean recovery path.

This model assumes a dedicated, expendable development Pi with no irreplaceable local data. Do not apply blanket AI access to a shared, production, or security-sensitive server.

## Start With An AI

You are probably reading this README on the project's GitHub page, where GitHub displays it below the repository file list. You do not need to follow a long list of shell commands here. Choose one of the guides below; it will show you how to use the **Code** menu on this page to put the repository on your computer, open it with the AI, and ask the AI to walk you through the setup at whatever level of detail you need.

- [Codex desktop app](docs/getting-started/chatgpt-codex-app.md) - the workflow used to develop this project.
- [Visual Studio Code with the Codex extension](docs/getting-started/vscode-codex.md) - for working beside the files in an editor.
- [Codex command line](docs/getting-started/codex-cli.md) - for a terminal-first OpenAI workflow.
- [Claude Code](docs/getting-started/claude-code.md) - for a terminal-first Anthropic workflow.
- [Another local coding agent](docs/getting-started/other-agent.md) - requirements and a provider-neutral starting prompt.

The agent-facing Raspberry Pi runbook is [deploy/pi/agent-setup.md](deploy/pi/agent-setup.md). Humans can read it, but it is written for an agent that can inspect the local machine, generate an SSH key, substitute the real public key into commands, connect to the Pi, install packages, and verify the result. You should never have to replace `PASTE_PUBLIC_KEY_HERE` or similar placeholder text yourself.

## Optional Local-Computer Setup

If you only want to run this web service, a Raspberry Pi is not required. The browser interface and the project's own Python HTTP backend can run directly on your local computer. No separate web framework is required.

Local hosting is a supported option, but it is not the environment in which the project was developed. The complete FEniCSx path is most straightforward on Raspberry Pi OS or another Debian-based Linux system; on Windows, an agent may recommend WSL 2 for the solver backend.

Tell your chosen agent that you want a local-only installation and have it adapt [deploy/pi/package-requirements.md](deploy/pi/package-requirements.md) to your operating system. It should explain which features it verified and which remain Pi-specific.

## Concept

The filter is based on a cylindrical, discoidal capacitor stack:

- Alternating high-voltage center plates and grounded annular plates.
- A central resistive core in the 100 Mohm to low Gohm range.
- Dielectric between overlapping HV and ground plate regions to provide useful capacitance.
- Lower-permittivity dielectric near the resistive core and outer fringe regions to reduce parasitic capacitance where appropriate.
- Flat ceramic washer slabs in the axial gaps between plate faces, with epoxy fill in rounded-edge pockets and other non-washer voids.
- Separate outer ground rings that can couple to a surrounding tube, allowing adjustment of ground separation between input and output.
- Prototype I/O based on screw terminals, with later revisions expected to directly support SHV bulkhead connectors.

## Repository Map

- `docs/getting-started/` - short human guides for opening the project with an AI agent.
- `deploy/pi/` - agent-facing Raspberry Pi installation and hosting runbooks.
- `docs/knowledge/` - curated design knowledge, requirements, assumptions, and decisions.
- `docs/chats/raw/` - raw AI collaboration transcripts and exported chats.
- `docs/chats/markdown/` - cleaned summaries derived from raw chats.
- `hardware/` - geometry, materials, connector, and prototype design notes.
- `simulations/` - simulation plans, parameter definitions, and solver work.
- `presentations/web/` - the interactive web designer and presentation.
- `software/` - calculation, geometry, solver, and backend code.

## Current Tooling

The repository includes an axisymmetric geometry and electrostatic model:

```powershell
python software/bias_filter/axisymmetric_model.py export
python software/bias_filter/axisymmetric_model.py solve
python software/bias_filter/axisymmetric_model.py cad
```

The browser page at `presentations/web/index.html` mirrors the same first-order r-z model for interactive design changes and peak-field screening. CAD and mesh exports are generated under `hardware/geometry/generated/`.

The JavaScript and Python finite-difference solvers are structured-grid screening tools. The optional FEniCSx/DOLFINx backend uses a conforming Gmsh r-z dielectric domain and reports field and capacitance checks, including an adjacent-bias parasitic-capacitance estimate from a separate three-bias-plate solve. Peak-field results still require mesh-convergence work before they should be treated as validated breakdown limits.

The backend also provides RC-ladder and SPICE-style response calculations using `ngspice` when available, with an internal modified-nodal fallback.

## AI Collaboration

Agents should read the root `AGENT.md`, the nearest directory-specific `AGENT.md`, and [deploy/pi/agent-setup.md](deploy/pi/agent-setup.md) before installing or deploying the project. Hostnames, IP addresses, passwords, private keys, and current deployment paths belong in ignored local files, never in committed documentation.
