import fs from 'node:fs/promises';
import path from 'node:path';
import { readMetadata, writeMetadata } from './state-store.js';

function sanitizeProfileName(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

function assertSafeProfileName(name) {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('Invalid profile name');
  }
}

function detectProtocol(fileName) {
  if (fileName.endsWith('.conf')) return 'wireguard';
  if (fileName.endsWith('.ovpn')) return 'openvpn';
  return null;
}

async function parseProfileFile(profilePath, protocol) {
  const raw = await fs.readFile(profilePath, 'utf8');
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const parsed = {
    protocol,
    endpoint: null,
    allowedIps: [],
    dns: [],
    authUserPass: false,
  };

  for (const line of lines) {
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (protocol === 'wireguard') {
      const [k, ...rest] = line.split('=');
      const key = k?.trim().toLowerCase();
      const value = rest.join('=').trim();
      if (key === 'endpoint') parsed.endpoint = value;
      if (key === 'allowedips') parsed.allowedIps = value.split(',').map((v) => v.trim()).filter(Boolean);
      if (key === 'dns') parsed.dns = value.split(',').map((v) => v.trim()).filter(Boolean);
    }
    if (protocol === 'openvpn') {
      if (line.toLowerCase().startsWith('remote ')) parsed.endpoint = line.slice(7).trim();
      if (line.toLowerCase().startsWith('auth-user-pass')) parsed.authUserPass = true;
    }
  }
  return { raw, parsed };
}

export async function listProfiles(paths) {
  const entries = await fs.readdir(paths.profilesDir, { withFileTypes: true });
  const metadata = await readMetadata(paths);
  const profiles = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const protocol = detectProtocol(entry.name);
    if (!protocol) continue;
    const name = sanitizeProfileName(entry.name);
    const profilePath = path.join(paths.profilesDir, entry.name);
    const stats = await fs.stat(profilePath);
    profiles.push({
      name,
      file: entry.name,
      protocol,
      path: profilePath,
      lastUsed: metadata.profiles?.[name]?.lastUsed ?? null,
      updatedAt: stats.mtime.toISOString(),
    });
  }

  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProfile(paths, name) {
  const profiles = await listProfiles(paths);
  const profile = profiles.find((item) => item.name === name);
  if (!profile) return null;
  const { raw, parsed } = await parseProfileFile(profile.path, profile.protocol);
  return { ...profile, raw, parsed };
}

export async function importProfile(paths, sourceName, content) {
  const protocol = detectProtocol(sourceName);
  if (!protocol) throw new Error('Unsupported profile format; expected .conf or .ovpn');
  const profileName = sanitizeProfileName(sourceName);
  assertSafeProfileName(profileName);
  const extension = protocol === 'wireguard' ? '.conf' : '.ovpn';
  const targetFile = `${profileName}${extension}`;
  const targetPath = path.join(paths.profilesDir, targetFile);
  await fs.writeFile(targetPath, content, 'utf8');
  return getProfile(paths, profileName);
}

export async function deleteProfile(paths, profileName) {
  const profile = await getProfile(paths, profileName);
  if (!profile) return false;
  await fs.unlink(profile.path);
  return true;
}

export async function renameProfile(paths, oldName, newName) {
  const current = await getProfile(paths, oldName);
  if (!current) return null;
  const safeName = sanitizeProfileName(newName);
  assertSafeProfileName(safeName);
  const ext = current.protocol === 'wireguard' ? '.conf' : '.ovpn';
  const targetPath = path.join(paths.profilesDir, `${safeName}${ext}`);
  await fs.rename(current.path, targetPath);

  const metadata = await readMetadata(paths);
  metadata.profiles ??= {};
  if (metadata.profiles[oldName]) {
    metadata.profiles[safeName] = metadata.profiles[oldName];
    delete metadata.profiles[oldName];
  }
  if (metadata.lastUsed === oldName) metadata.lastUsed = safeName;
  await writeMetadata(paths, metadata);

  return getProfile(paths, safeName);
}

export async function markProfileUsed(paths, profileName) {
  const metadata = await readMetadata(paths);
  metadata.lastUsed = profileName;
  metadata.profiles ??= {};
  metadata.profiles[profileName] = {
    ...(metadata.profiles[profileName] ?? {}),
    lastUsed: new Date().toISOString(),
  };
  await writeMetadata(paths, metadata);
}
