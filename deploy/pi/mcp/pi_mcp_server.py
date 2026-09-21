"""MCP server exposing shell and file access to a single Raspberry Pi.

Runs on the workstation (not on the Pi) and shells out to the system `ssh` and
`scp`, so it reuses whatever key, ssh config and known_hosts already work from
that machine. No credentials are stored here and none are returned to the
caller.

The target host is a module constant on purpose. The Pi is designated an
expendable AI development machine with blanket NOPASSWD sudo; that grant
applies to this one host and must not extend to other institutional machines.
Hard-coding the host keeps that boundary in code rather than in the caller's
judgement, so a prompt cannot redirect these tools at another server.
"""

from __future__ import annotations

import os
import shlex
import subprocess

try:  # mcp >= 2 renamed FastMCP to MCPServer
    from mcp.server.mcpserver import MCPServer as _MCPServer
except ImportError:  # mcp < 2
    from mcp.server.fastmcp import FastMCP as _MCPServer

# --- Scope -----------------------------------------------------------------
PI_HOST = "pi-05-ioc.fel.duke.edu"
PI_USER = "agent"
PI_KEY = os.environ.get(
    "PI_SSH_KEY",
    os.path.join(os.path.expanduser("~"), ".ssh", "shv_bias_filter_agent_ed25519"),
)

DEFAULT_TIMEOUT_S = 120
MAX_TIMEOUT_S = 900
MAX_OUTPUT_CHARS = 60_000

mcp = _MCPServer("pi-05-ioc")


def _ssh_base() -> list[str]:
    return [
        "ssh",
        "-i", PI_KEY,
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=10",
        f"{PI_USER}@{PI_HOST}",
    ]


def _clip(text: str) -> str:
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    return text[:MAX_OUTPUT_CHARS] + f"\n... [truncated, {len(text) - MAX_OUTPUT_CHARS} more chars]"


def _format(proc: subprocess.CompletedProcess) -> str:
    parts = [f"exit={proc.returncode}"]
    if proc.stdout:
        parts.append("--- stdout ---\n" + _clip(proc.stdout.rstrip()))
    if proc.stderr:
        parts.append("--- stderr ---\n" + _clip(proc.stderr.rstrip()))
    if not proc.stdout and not proc.stderr:
        parts.append("(no output)")
    return "\n".join(parts)


@mcp.tool()
def pi_run(command: str, timeout_s: int = DEFAULT_TIMEOUT_S) -> str:
    """Run a shell command on the Raspberry Pi over SSH and return its output.

    The command runs as the `agent` account, which holds passwordless sudo on
    this host. Returns exit code, stdout and stderr. Long output is truncated.

    Args:
        command: Shell command to run on the Pi.
        timeout_s: Seconds before the command is abandoned (max 900).
    """
    timeout_s = max(1, min(int(timeout_s), MAX_TIMEOUT_S))
    try:
        proc = subprocess.run(
            _ssh_base() + [command],
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired:
        return f"exit=timeout\nCommand exceeded {timeout_s}s and was abandoned:\n{command}"
    except FileNotFoundError:
        return "exit=error\n`ssh` was not found on PATH of the machine running this server."
    return _format(proc)


@mcp.tool()
def pi_put(local_path: str, remote_path: str) -> str:
    """Copy a local file to the Raspberry Pi over SCP.

    Args:
        local_path: Path to an existing file on the machine running this server.
        remote_path: Destination path on the Pi.
    """
    if not os.path.isfile(local_path):
        return f"exit=error\nNo such local file: {local_path}"
    size = os.path.getsize(local_path)
    try:
        proc = subprocess.run(
            [
                "scp",
                "-i", PI_KEY,
                "-o", "BatchMode=yes",
                "-o", "ConnectTimeout=10",
                local_path,
                f"{PI_USER}@{PI_HOST}:{remote_path}",
            ],
            capture_output=True,
            text=True,
            timeout=MAX_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        return "exit=timeout\nTransfer did not finish in time."
    except FileNotFoundError:
        return "exit=error\n`scp` was not found on PATH of the machine running this server."
    if proc.returncode == 0:
        return f"exit=0\nCopied {size} bytes to {PI_HOST}:{remote_path}"
    return _format(proc)


@mcp.tool()
def pi_get(remote_path: str, local_path: str) -> str:
    """Copy a file from the Raspberry Pi to the machine running this server.

    Args:
        remote_path: Path to the file on the Pi.
        local_path: Destination path on the local machine.
    """
    try:
        proc = subprocess.run(
            [
                "scp",
                "-i", PI_KEY,
                "-o", "BatchMode=yes",
                "-o", "ConnectTimeout=10",
                f"{PI_USER}@{PI_HOST}:{remote_path}",
                local_path,
            ],
            capture_output=True,
            text=True,
            timeout=MAX_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        return "exit=timeout\nTransfer did not finish in time."
    except FileNotFoundError:
        return "exit=error\n`scp` was not found on PATH of the machine running this server."
    if proc.returncode == 0:
        return f"exit=0\nFetched {remote_path} to {local_path}"
    return _format(proc)


@mcp.tool()
def pi_info() -> str:
    """Report which host these tools reach and whether it answers right now."""
    probe = subprocess.run(
        _ssh_base() + ["uptime; systemctl is-active agent-sites.service"],
        capture_output=True,
        text=True,
        timeout=20,
    )
    reachable = "yes" if probe.returncode == 0 else "no"
    return (
        f"host={PI_HOST}\nuser={PI_USER}\nkey={PI_KEY}\nreachable={reachable}\n"
        + _format(probe)
    )


if __name__ == "__main__":
    mcp.run()
