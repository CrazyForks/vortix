import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureConfigLayout, layout } from '../src/lib/paths.js';
import { importProfile, getProfile, renameProfile, deleteProfile } from '../src/lib/profile-store.js';

async function tempPaths() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vortix-node-test-'));
  await ensureConfigLayout(root);
  return layout(root);
}

test('imports and reads a wireguard profile', async () => {
  const paths = await tempPaths();
  const profile = await importProfile(paths, 'work.conf', '[Interface]\nAddress = 10.0.0.2/24\n[Peer]\nAllowedIPs = 0.0.0.0/0\n');
  assert.equal(profile.name, 'work');

  const loaded = await getProfile(paths, 'work');
  assert.equal(loaded.protocol, 'wireguard');
  assert.deepEqual(loaded.parsed.allowedIps, ['0.0.0.0/0']);
});

test('rename then delete profile', async () => {
  const paths = await tempPaths();
  await importProfile(paths, 'office.ovpn', 'client\nremote 1.2.3.4 1194\nauth-user-pass\n');
  const renamed = await renameProfile(paths, 'office', 'corp');
  assert.equal(renamed.name, 'corp');

  const removed = await deleteProfile(paths, 'corp');
  assert.equal(removed, true);
});
