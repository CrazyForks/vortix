import os from 'node:os';

export async function syntheticTelemetrySnapshot() {
  const interfaces = os.networkInterfaces();
  const ifaceNames = Object.keys(interfaces);
  const activeInterface = ifaceNames.find((name) => name.startsWith('wg') || name.startsWith('tun')) ?? ifaceNames[0] ?? 'unknown';
  const now = Date.now();

  // Placeholder telemetry: timestamp-based modulo arithmetic generates
  // deterministic, changing values for demo/development sessions until
  // per-platform socket + interface sampling lands.
  return {
    sampledAt: new Date(now).toISOString(),
    interface: activeInterface,
    latencyMs: 15 + (now % 40),
    jitterMs: 2 + (now % 8),
    packetLossPct: Number(((now % 3) * 0.1).toFixed(2)),
    downloadKbps: 3_000 + (now % 1_500),
    uploadKbps: 900 + (now % 600),
    ipv6LeakDetected: false,
    dnsLeakDetected: false,
  };
}
