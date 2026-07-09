# Pi Package Requirements

This file is for the setup agent. Install these packages on Raspberry Pi OS 64-bit or Debian arm64 before starting `codex-sites.service`.

## Required Base Packages

```bash
sudo apt update
sudo apt install -y \
  git \
  openssh-server \
  curl \
  rsync \
  python3 \
  python3-venv \
  python3-pip
```

## FEniCSx / Gmsh Backend Packages

Install these so the web app can run the conforming FEniCSx field backend:

```bash
sudo apt install -y \
  fenicsx \
  gmsh \
  python3-gmsh \
  python3-dolfinx \
  python3-ufl \
  python3-mpi4py \
  python3-petsc4py
```

## SPICE Backend Package

Install `ngspice` when available. The backend has an internal Python fallback, but `ngspice` is preferred for the SPICE-style ladder endpoint.

```bash
sudo apt install -y ngspice
```

## Import Checks

Run these after installation:

```bash
python3 - <<'PY'
import dolfinx, gmsh, mpi4py, petsc4py, ufl
print("FEniCSx import check passed")
PY
```

```bash
ngspice -v
```

If `ngspice` is unavailable, continue with setup and note that `/api/spice-ladder` will use the internal modified-nodal fallback.
