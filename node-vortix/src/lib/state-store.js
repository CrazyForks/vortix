import fs from 'node:fs/promises';

async function readJson(path, fallback) {
  try {
    const raw = await fs.readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readMetadata(paths) {
  return readJson(paths.metadataPath, { lastUsed: null, profiles: {} });
}

export async function writeMetadata(paths, metadata) {
  await writeJson(paths.metadataPath, metadata);
}

export async function readConnectionState(paths) {
  return readJson(paths.statePath, { connections: [], primary: null });
}

export async function writeConnectionState(paths, state) {
  await writeJson(paths.statePath, state);
}

export async function readKillSwitch(paths) {
  return readJson(paths.killSwitchPath, { mode: 'off', armed: false, updatedAt: null });
}

export async function writeKillSwitch(paths, state) {
  await writeJson(paths.killSwitchPath, state);
}
