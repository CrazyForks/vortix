# Vortix Node

Node.js end-to-end Vortix implementation (TUI + CLI) living alongside the Rust implementation.

## Features

- TUI dashboard (`vortix-node`) with profile list, connection controls, and telemetry panel
- CLI commands mirroring Vortix surface: `up`, `down`, `reconnect`, `status`, `list`, `import`, `show`, `delete`, `rename`, `killswitch`, `release-killswitch`, `info`, `audit`, `daemon`, `update`, `report`, `completions`
- JSON envelope output via `--json`, quiet mode via `--quiet`
- Config dir override via `--config-dir` or `VORTIX_CONFIG_DIR`
- WireGuard/OpenVPN command execution for connect/disconnect flows

## Install

```bash
cd /tmp/workspace/Harry-kp/vortix/node-vortix
npm install
```

## Run

```bash
# launch TUI
npm start

# example CLI
node src/index.js import /path/to/profile.conf
node src/index.js up my-profile
node src/index.js status --json
```

## Test

```bash
npm test
```
