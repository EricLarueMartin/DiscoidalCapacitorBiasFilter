# Pi MCP Server

Gives an AI assistant running in the Claude desktop app shell and file access to
the project's Raspberry Pi.

## Why this exists

The desktop app's sandboxed Linux VM has no raw network stack — only an HTTP(S)
proxy. A TCP connection to port 22 fails with `Network is unreachable` for any
host, public or LAN, so SSH cannot originate from there. This server runs as a
subprocess of the desktop app on the workstation itself, which does have normal
network access to the Pi, and relays commands over the workstation's own `ssh`.

Keep host-specific addresses, key paths and credentials out of this file; see
`.secrets/` for those.

## Scope

`PI_HOST` is a module constant, not a tool parameter. The Pi carries blanket
NOPASSWD sudo for the `agent` account; that grant is for this one host and does
not extend to other institutional machines. Hard-coding the target means no
instruction reaching the assistant can redirect these tools at another server.

## Requirements

- Python 3.10+ on the workstation
- `pip install mcp`
- `ssh` and `scp` on PATH (built into Windows 10+)
- A working key-based login to the Pi. Verify before configuring:

```
ssh -i "%USERPROFILE%\.ssh\<key>" agent@<pi-host> uptime
```

The server never prompts for a password (`BatchMode=yes`), so key auth must
already work non-interactively.

## Configuration

Add to the Claude desktop app's MCP configuration, then restart the app:

```json
{
  "mcpServers": {
    "pi": {
      "command": "python",
      "args": ["<repo>/deploy/pi/mcp/pi_mcp_server.py"],
      "env": { "PI_SSH_KEY": "<absolute path to private key>" }
    }
  }
}
```

`PI_SSH_KEY` is optional; it defaults to `~/.ssh/shv_bias_filter_agent_ed25519`.
Use absolute paths — the app does not resolve `~` or relative paths in `args`.

## Tools

| tool | purpose |
|---|---|
| `pi_run(command, timeout_s)` | run a shell command, return exit code and output |
| `pi_put(local_path, remote_path)` | copy a file to the Pi |
| `pi_get(remote_path, local_path)` | copy a file from the Pi |
| `pi_info()` | report the target host and whether it answers |

Output is truncated at 60k characters and commands time out at 120 s by default
(900 s maximum), so a hung command cannot stall the session indefinitely.

## Checking it works

Once the app restarts, ask the assistant to call `pi_info`. It should report the
host, `reachable=yes`, and the current state of `agent-sites.service`.
