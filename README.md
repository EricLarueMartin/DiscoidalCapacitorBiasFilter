# SHV Bias Filter

This repository captures the design, simulation, prototyping, and presentation work for a high-voltage low-current detector bias filter.

The initial target is LEGEND-style detector biasing using SHV connectors, where the practical voltage envelope is about 6 kV and detector currents are typically sub-nA. The design should remain adaptable to other experiments, connector families, voltages, and detector technologies.

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

- `docs/knowledge/` - Curated design knowledge, requirements, assumptions, and decisions.
- `docs/chats/raw/` - Raw AI collaboration transcripts and exported chats.
- `docs/chats/markdown/` - Cleaned, hierarchical summaries derived from raw chats.
- `hardware/` - Geometry, materials, connector, and prototype design notes.
- `simulations/` - Simulation plans, parameter definitions, and solver work.
- `presentations/web/` - Web-based presentation material, similar to slide decks.
- `software/` - Future utilities for calculations, geometry generation, data processing, or presentation tooling.

## Current Tooling

The repository includes an initial axisymmetric geometry and electrostatic model:

```powershell
python software/bias_filter/axisymmetric_model.py export
python software/bias_filter/axisymmetric_model.py solve
python software/bias_filter/axisymmetric_model.py cad
```

The browser page at `presentations/web/index.html` mirrors the same first-order r-z model for interactive design changes and peak-field screening. CAD and mesh exports are generated under `hardware/geometry/generated/`.

Important current solver caveat: the JavaScript and Python finite-difference solvers are axisymmetric cylindrical screening tools on a nonconformal structured r-z grid. They report a neighborhood-supported peak plus a raw point maximum diagnostic because isolated point spikes near rounded conductor edges can be numerical artifacts. The washer overlap fields currently check correctly against `V / gap`, but peak fields near rounded edges still need conforming FEA mesh-convergence studies before they can be used as validated breakdown-design limits.

An optional FEniCSx/DOLFINx backend is implemented on the Pi and can be requested from the solver dropdown. It uses a conforming Gmsh r-z dielectric domain with conductors removed as holes. The deployed FEniCSx path passes the flat washer sanity check: 6 kV across the default washer gaps samples at about `V / gap` in the plate-overlap region. It also reports capacitance sanity checks: total HV-to-ground capacitance from the all-HV energy integral, and an adjacent-bias `Cpar` estimate from a separate local three-bias-plate solve. It is still pre-acceptance until local mesh refinement and peak-convergence records are added.

MELF direct-stage presets now keep resistance as a direct per-stage value but model parasitic capacitance geometrically. The MELF body is treated as a ceramic core with an effective permittivity `eps_eff = eps_substrate / (1 - film_fill_factor)` to approximate metal-film shielding without trying to model the proprietary spiral trim. Defaults are alumina-like `eps_substrate = 9.8` and `film_fill_factor = 0.50` for 0207.

The web field map uses an absolute electric-field color scale in V/mm. Dielectric breakdown values are reference/margin information only, not per-material color normalizers.

The attenuation and SPICE-style frequency-response plots use a fixed 1 Hz to 100 MHz range. The low end makes the power-line rolloff easier to read while avoiding excessive very-slow-drift plot space, and the high end is sufficient for a DAQ sample rate around 200 MS/s where response above roughly 100 MHz is not a primary design driver.

## Raspberry Pi Agent Bootstrap

This section is for the human setting up a new Raspberry Pi. Stop once SSH as the agent account works. After that, give the agent the connection details and tell it to follow [deploy/pi/agent-setup.md](deploy/pi/agent-setup.md).

### 1. Install The OS

Use Raspberry Pi Imager and install **Raspberry Pi OS 64-bit**.

During imaging:

- Set a recognizable hostname, for example `shv-filter-pi`.
- Enable SSH.
- Configure Wi-Fi or Ethernet as appropriate.
- Create an initial admin user you control.
- Recommended: enable Raspberry Pi Connect during first boot, or install it immediately after. It gives you a browser-accessible console/desktop fallback if SSH, networking, or VPN routing is not right yet.

Boot the Pi, finish any first-run setup, and confirm it is on the network. Record the hostname or IP address; this is `PI_ADDRESS`.

### 2. Create An Agent SSH Key

On the workstation where Codex, Claude, or another terminal agent will run, create a dedicated key for this Pi. Do not reuse a personal SSH key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/shv_bias_filter_agent_ed25519 -C "shv-bias-filter-agent"
cat ~/.ssh/shv_bias_filter_agent_ed25519.pub
```

### 3. Create The Agent Account On The Pi

Log into the Pi as the initial admin user, then create a `codex` account for the agent and install the public key:

```bash
sudo adduser --disabled-password --gecos "" codex
sudo install -d -m 700 -o codex -g codex /home/codex/.ssh
printf '%s\n' 'PASTE_PUBLIC_KEY_HERE' | sudo tee /home/codex/.ssh/authorized_keys >/dev/null
sudo chown codex:codex /home/codex/.ssh/authorized_keys
sudo chmod 600 /home/codex/.ssh/authorized_keys
```

Give the agent sudo during setup so it can install packages and manage the service:

```bash
sudo usermod -aG sudo codex
```

If this Pi will be kept long term, replace broad sudo later with a narrow service-management rule after setup is complete.

### 4. Verify Agent SSH Access

From the workstation:

```bash
ssh -i ~/.ssh/shv_bias_filter_agent_ed25519 codex@PI_ADDRESS 'whoami && hostname'
```

Expected output starts with `codex`. Once this works, hand the agent:

- `PI_ADDRESS`
- SSH user: `codex`
- Private key path: `~/.ssh/shv_bias_filter_agent_ed25519`
- Repository URL or a local sync method
- The instruction to follow [deploy/pi/agent-setup.md](deploy/pi/agent-setup.md)

The agent should install packages, clone or sync the repository, install the service, run smoke tests, and then report the final clickable URL tailored to your Pi address.

Do not commit private keys, passwords, or `.secrets/` files to this repository.

## AI Collaboration

Each directory contains an `AGENT.md` file. Agents should read the nearest `AGENT.md` first, then walk upward to the root `AGENT.md` for project-wide conventions.

Raw chats should be preserved before being summarized. Curated knowledge should link back to raw sources when practical so public readers can distinguish settled design intent from exploratory conversation.
