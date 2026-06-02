import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readConnectionState, writeConnectionState } from './state-store.js';
import { getProfile, markProfileUsed } from './profile-store.js';

const execFileAsync = promisify(execFile);

function findConnection(state, name) {
  return state.connections.find((item) => item.profile === name) ?? null;
}

function getPrimary(connections) {
  return connections.find((item) => item.isPrimary)?.profile ?? null;
}

async function runCommand(command, args, timeoutMs) {
  const { stdout, stderr } = await execFileAsync(command, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
  return { stdout, stderr };
}

async function connectWireGuard(profile, timeoutSecs) {
  await runCommand('wg-quick', ['up', profile.path], timeoutSecs * 1000);
}

async function connectOpenVpn(profile, paths, timeoutSecs) {
  const pidFile = path.join(paths.runDir, `${profile.name}.pid`);
  const logFile = path.join(paths.runDir, `${profile.name}.log`);
  const authPath = path.join(paths.authDir, profile.name);
  const args = ['--config', profile.path, '--daemon', '--writepid', pidFile, '--log', logFile];
  try {
    await fs.access(authPath);
    args.push('--auth-user-pass', authPath);
  } catch {}
  await runCommand('openvpn', args, timeoutSecs * 1000);
}

async function disconnectOpenVpn(profile, paths, force = false) {
  const pidFile = path.join(paths.runDir, `${profile.name}.pid`);
  try {
    const pidRaw = await fs.readFile(pidFile, 'utf8');
    const pid = Number.parseInt(pidRaw.trim(), 10);
    if (Number.isFinite(pid)) {
      if (process.platform === 'linux') {
        const cmdline = await fs.readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '');
        if (!cmdline.includes('openvpn')) {
          throw new Error(`Refusing to signal non-openvpn pid ${pid}`);
        }
      }
      process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
    }
    await fs.unlink(pidFile).catch(() => {});
  } catch {
    if (force) {
      await runCommand('pkill', ['-f', `${profile.name}.ovpn`], 4_000).catch(() => {});
    }
  }
}

export async function connectProfile(paths, profileName, timeoutSecs = 20, forceConflict = false) {
  const state = await readConnectionState(paths);
  const profile = await getProfile(paths, profileName);
  if (!profile) {
    return { ok: false, code: 'not_found', message: `Profile '${profileName}' not found` };
  }

  if (findConnection(state, profile.name)) {
    return { ok: false, code: 'state_conflict', message: `Profile '${profile.name}' is already connected` };
  }

  if (!forceConflict && state.connections.length > 0 && profile.parsed.allowedIps.includes('0.0.0.0/0')) {
    return {
      ok: false,
      code: 'state_conflict',
      message: 'Default-route takeover conflict detected; re-run with --yes to bypass',
    };
  }

  try {
    if (profile.protocol === 'wireguard') await connectWireGuard(profile, timeoutSecs);
    if (profile.protocol === 'openvpn') await connectOpenVpn(profile, paths, timeoutSecs);
  } catch (error) {
    const raw = String(error?.message ?? error);
    const missing = raw.includes('ENOENT') || raw.includes('not found');
    return {
      ok: false,
      code: missing ? 'dependency_missing' : 'general_error',
      message: raw,
    };
  }

  const connection = {
    profile: profile.name,
    protocol: profile.protocol,
    status: 'Connected',
    connectedAt: new Date().toISOString(),
    endpoint: profile.parsed.endpoint,
    isPrimary: state.connections.length === 0,
  };

  state.connections.push(connection);
  state.primary = getPrimary(state.connections);
  await writeConnectionState(paths, state);
  await markProfileUsed(paths, profile.name);

  return { ok: true, connection };
}

export async function disconnectProfile(paths, profileName, force = false) {
  const state = await readConnectionState(paths);
  const connection = findConnection(state, profileName);
  if (!connection) {
    return { ok: true, disconnected: false, profile: profileName };
  }

  const profile = await getProfile(paths, profileName);
  if (!profile) {
    state.connections = state.connections.filter((item) => item.profile !== profileName);
    state.primary = getPrimary(state.connections);
    await writeConnectionState(paths, state);
    return { ok: true, disconnected: true, profile: profileName };
  }

  try {
    if (profile.protocol === 'wireguard') await runCommand('wg-quick', ['down', profile.path], 20_000);
    if (profile.protocol === 'openvpn') await disconnectOpenVpn(profile, paths, force);
  } catch (error) {
    return { ok: false, code: 'general_error', message: String(error?.message ?? error) };
  }

  state.connections = state.connections.filter((item) => item.profile !== profileName);
  if (!state.connections.some((item) => item.isPrimary) && state.connections.length > 0) {
    state.connections[0].isPrimary = true;
  }
  state.primary = getPrimary(state.connections);
  await writeConnectionState(paths, state);

  return { ok: true, disconnected: true, profile: profileName };
}

export async function disconnectAll(paths, force = false) {
  const state = await readConnectionState(paths);
  const names = state.connections.map((item) => item.profile);
  const results = [];
  for (const name of names) {
    results.push(await disconnectProfile(paths, name, force));
  }
  return results;
}

export async function reconnect(paths, profileName = null) {
  if (profileName) {
    await disconnectProfile(paths, profileName, false);
    return connectProfile(paths, profileName, 20, true);
  }

  const state = await readConnectionState(paths);
  const targets = state.connections.map((item) => item.profile);
  const results = [];
  for (const target of targets) {
    await disconnectProfile(paths, target, false);
    results.push(await connectProfile(paths, target, 20, true));
  }
  return { ok: true, results };
}

export async function connectionStatus(paths) {
  const state = await readConnectionState(paths);
  const settled = await Promise.allSettled(
    state.connections.map(async (connection) => [connection.profile, await getProfile(paths, connection.profile)]),
  );
  const parsedProfiles = new Map(
    settled
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value),
  );

  const connections = state.connections.map((connection) => ({
    ...connection,
    allowedIps: parsedProfiles.get(connection.profile)?.parsed?.allowedIps ?? [],
  }));

  const singleConnection = connections.length === 1 ? connections[0] : null;

  return {
    connections,
    primary: state.primary,
    connection: singleConnection,
  };
}
