import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

export function resolveConfigDir(overrideDir) {
  if (overrideDir) return path.resolve(overrideDir);
  if (process.env.VORTIX_CONFIG_DIR) return path.resolve(process.env.VORTIX_CONFIG_DIR);
  return path.join(os.homedir(), '.config', 'vortix-node');
}

export async function ensureConfigLayout(configDir) {
  const dirs = [
    configDir,
    path.join(configDir, 'profiles'),
    path.join(configDir, 'auth'),
    path.join(configDir, 'run'),
    path.join(configDir, 'logs'),
    path.join(configDir, 'sessions'),
  ];
  await Promise.all(dirs.map((dir) => fs.mkdir(dir, { recursive: true })));
}

export function layout(configDir) {
  return {
    configDir,
    profilesDir: path.join(configDir, 'profiles'),
    authDir: path.join(configDir, 'auth'),
    runDir: path.join(configDir, 'run'),
    logsDir: path.join(configDir, 'logs'),
    metadataPath: path.join(configDir, 'metadata.json'),
    statePath: path.join(configDir, 'connection-state.json'),
    killSwitchPath: path.join(configDir, 'killswitch.state.json'),
    journalPath: path.join(configDir, 'sessions', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.jsonl`),
  };
}
