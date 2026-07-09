# Agent Setup For Raspberry Pi Hosting

Follow this file after a human has completed the root README bootstrap:

- Raspberry Pi OS 64-bit is installed.
- SSH to `codex@PI_ADDRESS` works with the supplied key.
- The `codex` account has sudo during setup.
- You have either a repository URL or a way to sync this working tree to the Pi.

Your job is to finish the installation, verify it, and tell the user exactly how to open the hosted page.

## Inputs To Collect

Before running commands, identify:

- `PI_ADDRESS`: hostname or IP address used from the user's workstation.
- `REPOSITORY_URL`: Git URL for this repository, if cloning from Git.
- `PROJECT_DIR`: repository checkout or synced working tree on the Pi.
- `STATIC_ROOT`: document root served by the backend.
- `APP_PATH`: URL path for the app, usually `/shv-bias-filter/`.
- `STATIC_DIR`: static app directory, usually `STATIC_ROOT` plus `APP_PATH`.
- `SERVICE_NAME`: systemd service name.

If there is no Git remote available, sync the repository contents by the mechanism available in the current environment, then continue from the same `PROJECT_DIR`.

Use shell variables for the rest of setup so the commands can be adapted to the user's Pi:

```bash
export AGENT_USER="${AGENT_USER:-$(whoami)}"
export PROJECT_DIR="${PROJECT_DIR:-$HOME/projects/SHVBiasFilter}"
export STATIC_ROOT="${STATIC_ROOT:-$HOME/sites/public}"
export APP_PATH="${APP_PATH:-/shv-bias-filter/}"
export STATIC_DIR="${STATIC_DIR:-${STATIC_ROOT%/}${APP_PATH}}"
export SERVICE_NAME="${SERVICE_NAME:-codex-sites.service}"
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
cat > /tmp/shv-index.html <<HTML
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=$APP_PATH">
    <title>SHV Bias Filter</title>
  </head>
  <body>
    <p><a href="$APP_PATH">SHV Bias Filter</a></p>
  </body>
</html>
HTML
sudo install -d -m 755 -o "$AGENT_USER" -g "$AGENT_USER" "$STATIC_ROOT"
sudo install -m 644 -o "$AGENT_USER" -g "$AGENT_USER" /tmp/shv-index.html "$STATIC_ROOT/index.html"
```

## 4. Install The systemd Service

```bash
cd "$PROJECT_DIR"
sed \
  -e "s#__AGENT_USER__#$AGENT_USER#g" \
  -e "s#__PROJECT_DIR__#$PROJECT_DIR#g" \
  -e "s#__STATIC_ROOT__#$STATIC_ROOT#g" \
  deploy/pi/codex-sites.service > "/tmp/$SERVICE_NAME"
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
curl -fsS "http://127.0.0.1$APP_PATH" | grep -i "SHV Bias Filter"
```

Finite-difference job:

```bash
curl -fsS -X POST http://127.0.0.1/api/field-solve \
  -H 'Content-Type: application/json' \
  -d '{"client_id":"setup-smoke","solver":"fd","parameters":{"plate_pairs":1,"grid_r_count":24,"grid_z_count":36,"solver_iterations":80}}'
```

FEniCSx readiness:

```bash
cd "$PROJECT_DIR"
python3 software/bias_filter/fenicsx_solver.py --json
```

Optional small FEniCSx job:

```bash
curl -fsS -X POST http://127.0.0.1/api/field-solve \
  -H 'Content-Type: application/json' \
  -d '{"client_id":"fenicsx-smoke","solver":"fenicsx","parameters":{"plate_pairs":1,"grid_r_count":24,"grid_z_count":36,"mesh_edge_radius_ratio":0.35,"load_current_na":1.0}}'
```

If a solve returns a `job_id`, poll it:

```bash
curl -fsS "http://127.0.0.1/api/field-solve/JOB_ID"
```

Run backend tests if time allows:

```bash
cd "$PROJECT_DIR"
python3 -B -m unittest software.bias_filter.test_field_backend
```

## 6. Optional Sudo Tightening

After setup, ask the user whether to keep broad sudo for the `codex` account. For a longer-lived Pi, prefer a narrow sudoers file:

```bash
sudo visudo -f /etc/sudoers.d/shv-bias-filter-agent
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

Also summarize which solver paths passed smoke tests: static page, `/api/health`, finite-difference solve, FEniCSx readiness/job, and SPICE backend if checked.
