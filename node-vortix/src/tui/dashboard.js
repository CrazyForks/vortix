import blessed from 'blessed';
import { listProfiles } from '../lib/profile-store.js';
import { connectionStatus, connectProfile, disconnectProfile, reconnect } from '../lib/connection-service.js';
import { syntheticTelemetrySnapshot } from '../lib/telemetry-service.js';

function formatProfileLine(profile, status) {
  const connected = status.connections.find((conn) => conn.profile === profile.name);
  if (!connected) return `○ ${profile.name} (${profile.protocol})`;
  return connected.isPrimary ? `● ${profile.name} (${profile.protocol}, primary)` : `● ${profile.name} (${profile.protocol})`;
}

export async function launchDashboard(paths) {
  const screen = blessed.screen({ smartCSR: true, title: 'Vortix Node' });

  const header = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    tags: true,
    border: 'line',
    content: '{bold}Vortix Node{/bold}  |  q quit  Enter toggle connect  d disconnect  r reconnect',
  });

  const profileList = blessed.list({
    top: 3,
    left: 0,
    width: '35%',
    height: '70%',
    border: 'line',
    label: ' Profiles ',
    keys: true,
    vi: true,
    style: { selected: { bg: 'blue' } },
  });

  const details = blessed.box({
    top: 3,
    left: '35%',
    width: '65%',
    height: '70%',
    border: 'line',
    label: ' Connection Details ',
    tags: true,
    content: 'Loading...',
    scrollable: true,
    alwaysScroll: true,
  });

  const logs = blessed.log({
    bottom: 0,
    left: 0,
    width: '100%',
    height: '30%',
    border: 'line',
    label: ' Event Log ',
    tags: true,
  });

  screen.append(header);
  screen.append(profileList);
  screen.append(details);
  screen.append(logs);

  let profiles = [];
  let status = { connections: [], primary: null };

  const render = async () => {
    profiles = await listProfiles(paths);
    status = await connectionStatus(paths);
    const telemetry = await syntheticTelemetrySnapshot();

    profileList.setItems(profiles.map((profile) => formatProfileLine(profile, status)));

    const selected = profiles[profileList.selected] ?? profiles[0] ?? null;
    const selectedConn = selected ? status.connections.find((conn) => conn.profile === selected.name) : null;

    details.setContent([
      `{bold}Active Connections:{/bold} ${status.connections.length}`,
      `{bold}Primary:{/bold} ${status.primary ?? 'none'}`,
      `{bold}Telemetry{/bold}`,
      `Interface: ${telemetry.interface}`,
      `Latency: ${telemetry.latencyMs} ms`,
      `Jitter: ${telemetry.jitterMs} ms`,
      `Packet loss: ${telemetry.packetLossPct}%`,
      `Down/Up: ${telemetry.downloadKbps} / ${telemetry.uploadKbps} Kbps`,
      '',
      `{bold}Selected Profile{/bold}`,
      selected ? `Name: ${selected.name}` : 'Name: (none)',
      selected ? `Protocol: ${selected.protocol}` : '',
      selectedConn ? `State: ${selectedConn.status}` : 'State: Disconnected',
      selectedConn?.endpoint ? `Endpoint: ${selectedConn.endpoint}` : 'Endpoint: -',
    ].filter(Boolean).join('\n'));

    screen.render();
  };

  profileList.focus();

  screen.key(['q', 'C-c'], () => process.exit(0));

  screen.key(['enter'], async () => {
    const profile = profiles[profileList.selected];
    if (!profile) return;
    const connected = status.connections.some((conn) => conn.profile === profile.name);
    if (connected) {
      await disconnectProfile(paths, profile.name);
      logs.log(`Disconnected ${profile.name}`);
    } else {
      const result = await connectProfile(paths, profile.name, 20, true);
      if (!result.ok) logs.log(`{red-fg}Connect failed:{/red-fg} ${result.message}`);
      else logs.log(`Connected ${profile.name}`);
    }
    await render();
  });

  screen.key(['d'], async () => {
    const profile = profiles[profileList.selected];
    if (!profile) return;
    await disconnectProfile(paths, profile.name, false);
    logs.log(`Disconnected ${profile.name}`);
    await render();
  });

  screen.key(['r'], async () => {
    const profile = profiles[profileList.selected];
    if (!profile) return;
    await reconnect(paths, profile.name);
    logs.log(`Reconnected ${profile.name}`);
    await render();
  });

  let renderErrors = 0;
  const timer = setInterval(() => {
    render().then(() => {
      renderErrors = 0;
    }).catch((error) => {
      renderErrors += 1;
      logs.log(`{red-fg}${error.message}{/red-fg}`);
      if (renderErrors >= 5) {
        clearInterval(timer);
        logs.log('{red-fg}Stopped auto-refresh after repeated render failures{/red-fg}');
      }
    });
  }, 1_000);

  screen.on('destroy', () => clearInterval(timer));

  await render();
}
