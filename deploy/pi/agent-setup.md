# Agent Setup For Raspberry Pi Hosting

This file is for the AI agent, not a human copy-and-paste tutorial. Own the setup from the user's current starting point through a verified hosted page. Explain physical and Raspberry Pi Imager steps at the level of detail the user requests, discover values when possible, and give the user fully rendered commands when a manual action is unavoidable.

Never ask a human to replace placeholders such as `PASTE_PUBLIC_KEY_HERE`. Generate a dedicated key, read its public half, and insert the actual public key, username, and paths into the exact command you ask the user to run.

## Target Architecture

- The coding agent runs on the user's Windows, macOS, or Linux computer.
- A dedicated Raspberry Pi runs Raspberry Pi OS 64-bit and hosts the web app, FEniCSx backend, and SPICE backend.
- The agent connects to the Pi over SSH using a dedicated key and a dedicated `agent` account.
- The `agent` account has blanket passwordless sudo because this workflow is intended for an AI-controlled development Pi.

The recommended model treats the Pi as an expendable AI development device. Once the user selects this model, install `agent ALL=(ALL) NOPASSWD: ALL` and do not repeatedly ask for authorization before package installation, service changes, reboots, or other ordinary administrative work needed to develop and verify the project. Important source and results must remain in Git or other off-device storage. If the OS becomes badly damaged, reimaging the microSD card is the clean recovery path.

Confirm the trust model only when it has not already been established. If the Pi is shared, contains sensitive data, or serves unrelated production work, use a narrower privilege model instead.

## Phase 1: Establish The Pi

First determine what the user already has. Do not repeat completed steps. The normal hardware target is a Raspberry Pi 5 with 4 GB RAM, a 64 GB high-endurance microSD card, the correct power supply, and Ethernet or Wi-Fi on the same reachable network as the agent's computer. A 2 GB Pi is the practical minimum for the current single-worker service; measured default electric and thermal FEniCSx subprocesses peaked at about 157 MiB and 252 MiB RSS, with peak total system use below 0.8 GiB. A 2 GB Pi 5 should run these meshes at essentially the same speed as higher-memory Pi 5 models while the working set fits. A Pi 4 with 2 GB or more is a slower fallback because of its older CPU and lower memory bandwidth, not because it has 2 GB of RAM. Prefer 8 GB only when the user expects unusually fine meshes, other substantial services, or broader development work on the same Pi.

If the OS is not installed, walk the user through the current Raspberry Pi Imager interface:

1. Install Raspberry Pi OS 64-bit.
2. Set a recognizable hostname.
3. Create a human administrator account whose password remains known only to the user.
4. Configure Wi-Fi if Ethernet will not be used.
5. Enable SSH.
6. Recommend Raspberry Pi Connect as a recovery path during initial setup.
7. Boot the Pi and help the user find or verify its hostname or IP address.

The human administrator account is only for bootstrap and recovery. Do not request or record its password. Ask the user to run privileged bootstrap commands in a terminal on the Pi or in their own SSH session when needed.

## Phase 2: Create Dedicated Agent Access

On the agent's local computer, choose a dedicated key path appropriate to the OS. Reuse an existing project-specific key only if its private file is present and protected. Otherwise generate an Ed25519 key non-interactively, with no passphrase so the agent can reconnect unattended. Do not overwrite an existing key.

Example key names:

- Linux/macOS: `~/.ssh/discoidal_capacitor_bias_filter_agent_ed25519`
- Windows: `%USERPROFILE%\.ssh\discoidal_capacitor_bias_filter_agent_ed25519`

Read the generated `.pub` file. Then render one complete bootstrap command for the user to paste into a terminal logged into the Pi as their human administrator. The rendered command must:

1. Create the `agent` account if it does not exist.
2. Create `/home/agent/.ssh` with mode `700` and correct ownership.
3. Write the actual public key to `/home/agent/.ssh/authorized_keys` with mode `600`.
4. Write a temporary sudoers rule containing `agent ALL=(ALL) NOPASSWD: ALL`.
5. Validate the temporary file with `visudo -cf`, then install it as `/etc/sudoers.d/discoidal-capacitor-bias-filter-agent` with mode `440`.

Use careful shell quoting around the actual public key. Build the command internally from a fixed account name and the public key you just generated; do not interpolate untrusted text from the user. The command shown to the human must contain no unresolved variables or placeholder tokens. It is acceptable for their existing administrator account to prompt for its sudo password; never ask them to share it with the agent.

After the user runs the command, test SSH from the agent's computer using the dedicated private key. Verify at least:

```bash
whoami
hostname
sudo -n true
```

Do not continue until the connection identifies the dedicated account and non-interactive sudo succeeds. Store host-specific connection details only in an ignored local file such as `.secrets/current-deployment.md`. Never commit the private key, passwords, IP address, or current deployment paths.

## Phase 3: Install And Deploy

Once SSH works, carry out the remaining steps directly over SSH. Ask the user to paste further commands only when the agent's environment cannot perform the operation itself.

Before changing the machine, record the current OS and architecture with `cat /etc/os-release` and `uname -m`. The intended platform is a current 64-bit Raspberry Pi OS or Debian-family installation reporting `aarch64`. If the Pi is 32-bit, stop and recommend reimaging it with a 64-bit OS rather than attempting a partial FEniCSx installation.

## Inputs To Collect

Before running commands, identify:

- `PI_ADDRESS`: hostname or IP address used from the user's workstation.
- `SSH_KEY_PATH`: local path to the dedicated private key.
- `AGENT_USER`: normally `agent`.
- `REPOSITORY_URL`: Git URL for this repository, if cloning from Git.
- `PROJECT_DIR`: repository checkout or synced working tree on the Pi.
- `STATIC_ROOT`: document root served by the backend.
- `APP_PATH`: URL path for the app, usually `/discoidal-capacitor-bias-filter/`.
- `STATIC_DIR`: static app directory, usually `STATIC_ROOT` plus `APP_PATH`.
- `SERVICE_NAME`: systemd service name.

If there is no Git remote available, sync the repository contents by the mechanism available in the current environment, then continue from the same `PROJECT_DIR`.

Use shell variables for the rest of setup so the commands can be adapted to the user's Pi:

```bash
export AGENT_USER="${AGENT_USER:-$(whoami)}"
export REPOSITORY_URL="${REPOSITORY_URL:-https://github.com/EricLarueMartin/DiscoidalCapacitorBiasFilter.git}"
export PROJECT_DIR="${PROJECT_DIR:-$HOME/projects/DiscoidalCapacitorBiasFilter}"
export STATIC_ROOT="${STATIC_ROOT:-$HOME/sites/public}"
export APP_PATH="${APP_PATH:-/discoidal-capacitor-bias-filter/}"
export STATIC_DIR="${STATIC_DIR:-${STATIC_ROOT%/}${APP_PATH}}"
export SERVICE_NAME="${SERVICE_NAME:-agent-sites.service}"
```

## 1. Install Packages

Read and follow [package-requirements.md](package-requirements.md). Install the base packages, FEniCSx/Gmsh packages, and `ngspice` if available.

After package installation, verify:

```bash
python3 - <<'PY'
import dolfinx, gmsh, mpi4py, petsc4py, ufl
print("FEniCSx import check passed")
PY
```

```bash
ngspice -v || true
```

## 2. Clone Or Sync The Repository

Create the project parent:

```bash
sudo install -d -m 755 -o "$AGENT_USER" -g "$AGENT_USER" "$(dirname "$PROJECT_DIR")"
```

If `PROJECT_DIR` does not exist and a Git URL is available:

```bash
git clone "$REPOSITORY_URL" "$PROJECT_DIR"
```

If `PROJECT_DIR` already exists:

```bash
cd "$PROJECT_DIR"
git pull --ff-only || true
```

If Git is not available for this repository, copy or rsync the local working tree into `PROJECT_DIR`. Preserve file paths.

## 3. Install Static Web Files

```bash
sudo install -d -m 755 -o "$AGENT_USER" -g "$AGENT_USER" "$STATIC_DIR"
rsync -a --delete "$PROJECT_DIR/presentations/web/" "$STATIC_DIR/"
```

Create a landing page that redirects to the project:

```bash
cat > /tmp/discoidal-filter-index.html <<HTML
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=$APP_PATH">
    <title>Discoidal Capacitor Bias Filter</title>
  </head>
  <body>
    <p><a href="$APP_PATH">Discoidal Capacitor Bias Filter</a></p>
  </body>
</html>
HTML
sudo install -d -m 755 -o "$AGENT_USER" -g "$AGENT_USER" "$STATIC_ROOT"
sudo install -m 644 -o "$AGENT_USER" -g "$AGENT_USER" /tmp/discoidal-filter-index.html "$STATIC_ROOT/index.html"
```

## 4. Install The systemd Service

```bash
cd "$PROJECT_DIR"
sed \
  -e "s#__AGENT_USER__#$AGENT_USER#g" \
  -e "s#__PROJECT_DIR__#$PROJECT_DIR#g" \
  -e "s#__STATIC_ROOT__#$STATIC_ROOT#g" \
  deploy/pi/agent-sites.service > "/tmp/$SERVICE_NAME"
sudo install -m 644 "/tmp/$SERVICE_NAME" "/etc/systemd/system/$SERVICE_NAME"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager -l
```

The service defaults to `--solver fd` for fast screening. Browser requests can still choose `FEniCSx required`; the request payload selects the FEniCSx worker per job.

## 5. Smoke Test The Service

Local Pi checks:

```bash
curl -fsS http://127.0.0.1/api/health
curl -fsS "http://127.0.0.1$APP_PATH" | grep -i "Discoidal Capacitor Bias Filter"
```

Finite-difference job and automatic polling:

```bash
python3 - <<'PY'
import json
import time
import urllib.request

base = "http://127.0.0.1"
payload = {
    "client_id": "setup-smoke",
    "solver": "fd",
    "parameters": {
        "plate_pairs": 1,
        "grid_r_count": 24,
        "grid_z_count": 36,
        "solver_iterations": 80,
    },
}
request = urllib.request.Request(
    base + "/api/field-solve",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(request, timeout=30) as response:
    result = json.load(response)

job_id = result.get("job_id")
if not job_id:
    raise RuntimeError(f"Field solve did not return a job ID: {result}")

for _ in range(120):
    with urllib.request.urlopen(base + "/api/field-solve/" + job_id, timeout=30) as response:
        result = json.load(response)
    if result.get("status") == "complete":
        print("Finite-difference smoke test passed:", job_id)
        break
    if result.get("status") == "failed":
        raise RuntimeError(result)
    time.sleep(1)
else:
    raise TimeoutError(f"Field solve did not finish: {job_id}")
PY
```

FEniCSx readiness:

```bash
cd "$PROJECT_DIR"
python3 software/bias_filter/fenicsx_solver.py --json
```

Run a small FEniCSx job through the web API as well. Submit it as the agent, capture the returned `job_id`, and poll `/api/field-solve/{job_id}` until it reports `complete` or `failed`. Use this request body:

```bash
curl -fsS -X POST http://127.0.0.1/api/field-solve \
  -H 'Content-Type: application/json' \
  -d '{"client_id":"fenicsx-smoke","solver":"fenicsx","parameters":{"plate_pairs":1,"grid_r_count":24,"grid_z_count":36,"mesh_edge_radius_ratio":0.35,"load_current_na":1.0}}'
```

SPICE endpoint:

```bash
curl -fsS -X POST http://127.0.0.1/api/spice-ladder \
  -H 'Content-Type: application/json' \
  -d '{"parameters":{"frequency_start_hz":1,"frequency_stop_hz":100000000,"frequency_point_count":24}}'
```

Confirm that the SPICE response has `status: ok`. Record whether its `source` reports `ngspice-ac` or the internal modified-nodal fallback.

Run backend tests if time allows:

```bash
cd "$PROJECT_DIR"
python3 -B -m unittest software.bias_filter.test_field_backend
```

## 6. Optional Sudo Tightening For Non-Dedicated Hosts

Keep broad sudo on a Pi designated as an expendable AI development device. For a shared or longer-lived host that does not use that trust model, agree on and install a narrow sudoers file:

```bash
sudo visudo -f /etc/sudoers.d/discoidal-capacitor-bias-filter-agent
```

Suggested contents:

```text
AGENT_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart SERVICE_NAME, /usr/bin/systemctl status SERVICE_NAME, /usr/bin/systemctl is-active SERVICE_NAME
```

Replace `AGENT_USER` and `SERVICE_NAME` with the actual values before saving the sudoers file.

Only remove broad sudo after verifying the user still has an admin account.

## 7. Troubleshooting

Service logs:

```bash
journalctl -u "$SERVICE_NAME" -n 120 --no-pager
```

Service status:

```bash
systemctl status "$SERVICE_NAME" --no-pager -l
```

Common fixes:

- If port 80 fails with permission errors, confirm the service file includes `AmbientCapabilities=CAP_NET_BIND_SERVICE`.
- If FEniCSx imports fail, rerun the package install step and confirm the OS is 64-bit.
- If the page loads but solves fail, check `/api/health` and then `journalctl`.
- If static files are stale, rerun the `rsync` command from the static install step and refresh the browser.

## Final Response Requirement

End your setup response by telling the user exactly how to access the hosted page. Use the actual hostname or IP address discovered during setup:

```markdown
Hosted page: [http://PI_ADDRESS/actual-app-path/](http://PI_ADDRESS/actual-app-path/)
Backend health: [http://PI_ADDRESS/api/health](http://PI_ADDRESS/api/health)
```

Replace `PI_ADDRESS` and `actual-app-path` with the verified host and `APP_PATH` used during setup.

Also summarize which paths passed smoke tests: static page, `/api/health`, finite-difference solve, FEniCSx readiness and job, backend unit tests, and the SPICE endpoint. State whether SPICE used `ngspice` or the internal fallback.
