import fs from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import { emit } from './output.js';
import { listProfiles, getProfile, importProfile, deleteProfile, renameProfile } from './profile-store.js';
import { connectProfile, disconnectProfile, disconnectAll, reconnect, connectionStatus } from './connection-service.js';
import { syntheticTelemetrySnapshot } from './telemetry-service.js';
import { readKillSwitch, writeKillSwitch } from './state-store.js';
import { KILLSWITCH_MODES } from '../constants.js';

function isPrivateIp(ip) {
  if (!net.isIP(ip)) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === '169.254.169.254') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  return false;
}

async function validateRemoteUrl(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https profile URLs are allowed');
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata'
  ) {
    throw new Error('Refusing localhost/metadata URL');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Refusing private-network URL');
    return;
  }

  const records = await dns.lookup(hostname, { all: true }).catch(() => []);
  if (records.length === 0) throw new Error('Unable to resolve URL host');
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error('Refusing URL that resolves to private-network address');
  }
}

export async function handleList(paths, options, mode) {
  let profiles = await listProfiles(paths);
  if (options.protocol) profiles = profiles.filter((p) => p.protocol === options.protocol.toLowerCase());
  const sort = options.sort ?? 'name';
  profiles.sort((a, b) => {
    if (sort === 'last-used') return (a.lastUsed ?? '').localeCompare(b.lastUsed ?? '');
    if (sort === 'protocol') return a.protocol.localeCompare(b.protocol);
    return a.name.localeCompare(b.name);
  });
  if (options.reverse) profiles.reverse();
  if (options.namesOnly && !mode.json && !mode.quiet) {
    for (const profile of profiles) console.log(profile.name);
    return 0;
  }
  return emit(mode, 'list', true, profiles);
}

export async function handleImport(paths, source, mode) {
  if (/^https?:\/\//.test(source)) {
    try {
      await validateRemoteUrl(source);
    } catch (error) {
      return emit(mode, 'import', false, null, { code: 'general_error', message: String(error.message ?? error) });
    }
    const res = await fetch(source);
    if (!res.ok) return emit(mode, 'import', false, null, { code: 'general_error', message: `Download failed: ${res.status}` });
    const content = await res.text();
    const fileName = new URL(source).pathname.split('/').pop() || 'profile.conf';
    const profile = await importProfile(paths, fileName, content);
    return emit(mode, 'import', true, profile, null, ['Run `vortix-node up <name>` to connect']);
  }

  const resolved = path.resolve(source);
  const stats = await fs.stat(resolved).catch(() => null);
  if (!stats) return emit(mode, 'import', false, null, { code: 'not_found', message: `Source '${source}' not found` });

  if (stats.isDirectory()) {
    const entries = await fs.readdir(resolved);
    const imported = [];
    for (const file of entries) {
      if (!file.endsWith('.conf') && !file.endsWith('.ovpn')) continue;
      const content = await fs.readFile(path.join(resolved, file), 'utf8');
      imported.push(await importProfile(paths, file, content));
    }
    return emit(mode, 'import', true, imported);
  }

  const content = await fs.readFile(resolved, 'utf8');
  const profile = await importProfile(paths, path.basename(resolved), content);
  return emit(mode, 'import', true, profile, null, ['Run `vortix-node up <name>` to connect']);
}

export async function handleShow(paths, profileName, options, mode) {
  const profile = await getProfile(paths, profileName);
  if (!profile) return emit(mode, 'show', false, null, { code: 'not_found', message: `Profile '${profileName}' not found` });
  return emit(mode, 'show', true, options.raw ? profile.raw : profile);
}

export async function handleDelete(paths, profileName, mode) {
  const ok = await deleteProfile(paths, profileName);
  if (!ok) return emit(mode, 'delete', false, null, { code: 'not_found', message: `Profile '${profileName}' not found` });
  return emit(mode, 'delete', true, { profile: profileName, deleted: true });
}

export async function handleRename(paths, oldName, newName, mode) {
  const renamed = await renameProfile(paths, oldName, newName);
  if (!renamed) return emit(mode, 'rename', false, null, { code: 'not_found', message: `Profile '${oldName}' not found` });
  return emit(mode, 'rename', true, renamed);
}

export async function handleUp(paths, profileName, options, mode) {
  const result = await connectProfile(paths, profileName, options.timeout, options.yes);
  if (!result.ok) return emit(mode, 'up', false, null, { code: result.code, message: result.message });
  return emit(mode, 'up', true, result.connection);
}

export async function handleDown(paths, profileName, options, mode) {
  if (profileName) {
    const result = await disconnectProfile(paths, profileName, options.force);
    if (!result.ok) return emit(mode, 'down', false, null, { code: result.code, message: result.message });
    return emit(mode, 'down', true, result);
  }
  const result = await disconnectAll(paths, options.force);
  return emit(mode, 'down', true, result);
}

export async function handleReconnect(paths, profileName, mode) {
  const result = await reconnect(paths, profileName);
  if (!result.ok) return emit(mode, 'reconnect', false, null, { code: result.code, message: result.message });
  return emit(mode, 'reconnect', true, result);
}

export async function handleStatus(paths, options, mode) {
  const snapshot = async () => {
    const status = await connectionStatus(paths);
    const telemetry = await syntheticTelemetrySnapshot();
    return { ...status, telemetry };
  };

  if (!options.watch) {
    const data = await snapshot();
    if (options.brief && !mode.json && !mode.quiet) {
      const label = data.connections.length > 0 ? `● Connected to ${data.connections.map((c) => c.profile).join(', ')}` : '○ Disconnected';
      console.log(label);
      return 0;
    }
    return emit(mode, 'status', true, data);
  }

  const streamMode = { ...mode, json: true, quiet: false };
  const intervalMs = Math.max(1, options.interval) * 1000;
  const pump = async () => emit(streamMode, 'status', true, await snapshot());
  await pump();
  const timer = setInterval(() => {
    pump().catch((error) => {
      clearInterval(timer);
      console.error(error);
      process.exit(1);
    });
  }, intervalMs);
  return await new Promise((resolve) => {
    process.on('SIGINT', () => {
      clearInterval(timer);
      resolve(0);
    });
  });
}

export async function handleKillSwitch(paths, modeArg, mode) {
  if (!modeArg) {
    const state = await readKillSwitch(paths);
    return emit(mode, 'killswitch', true, state);
  }

  if (!KILLSWITCH_MODES.has(modeArg)) {
    return emit(mode, 'killswitch', false, null, {
      code: 'general_error',
      message: `Invalid mode '${modeArg}'. Use: off, block-on-drop, vpn-only`,
    });
  }

  const state = {
    mode: modeArg,
    armed: modeArg !== 'off',
    updatedAt: new Date().toISOString(),
  };
  await writeKillSwitch(paths, state);
  return emit(mode, 'killswitch', true, state);
}

export async function handleReleaseKillSwitch(paths, mode) {
  const state = {
    mode: 'off',
    armed: false,
    updatedAt: new Date().toISOString(),
  };
  await writeKillSwitch(paths, state);
  return emit(mode, 'release-killswitch', true, state);
}

export async function handleInfo(paths, configSource, mode) {
  const profiles = await listProfiles(paths);
  const status = await connectionStatus(paths);
  const data = {
    config_dir: paths.configDir,
    config_source: configSource,
    profile_count: profiles.length,
    active_connections: status.connections.length,
    primary: status.primary,
    platform: process.platform,
    node: process.version,
    pid: process.pid,
  };
  return emit(mode, 'info', true, data);
}

export async function handleAudit(paths, options, mode) {
  const status = await connectionStatus(paths);
  const sockets = status.connections.map((conn, idx) => ({
    pid: process.pid,
    command: conn.protocol === 'wireguard' ? 'wg-quick' : 'openvpn',
    protocol: conn.protocol,
    local: `127.0.0.1:${52000 + idx}`,
    remote: conn.endpoint ?? '*',
    interface: conn.protocol === 'wireguard' ? `wg${idx}` : `tun${idx}`,
    profile: conn.profile,
  }));

  const filtered = sockets.filter((row) => (options.pid ? row.pid === Number(options.pid) : true)).filter((row) => (options.vpnOnly ? Boolean(row.interface) : true));
  return emit(mode, 'audit', true, { sockets: filtered });
}

export async function handleDaemon(mode) {
  return emit(mode, 'daemon', true, {
    message: 'Daemon mode placeholder: use PM2/systemd to run `vortix-node status --watch --json` for now.',
  });
}
