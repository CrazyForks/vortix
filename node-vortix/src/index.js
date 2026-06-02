#!/usr/bin/env node
import { Command } from 'commander';
import { resolveConfigDir, ensureConfigLayout, layout } from './lib/paths.js';
import {
  handleAudit,
  handleDaemon,
  handleDelete,
  handleDown,
  handleImport,
  handleInfo,
  handleKillSwitch,
  handleList,
  handleReconnect,
  handleReleaseKillSwitch,
  handleRename,
  handleShow,
  handleStatus,
  handleUp,
} from './lib/command-handlers.js';
import { launchDashboard } from './tui/dashboard.js';
import { listProfiles } from './lib/profile-store.js';

const program = new Command();
program
  .name('vortix-node')
  .description('Node.js implementation of Vortix TUI + CLI')
  .option('-C, --config-dir <dir>', 'Override config directory')
  .option('-j, --json', 'Machine-readable JSON output')
  .option('-q, --quiet', 'Suppress output except errors')
  .option('-v, --verbose', 'Verbose output');

program
  .command('up [profile]')
  .option('--timeout <secs>', 'Connection timeout in seconds', '20')
  .option('-y, --yes', 'Bypass conflict gate')
  .action(async (profile, options) => {
    const ctx = await context(program.opts());
    const name = profile ?? (await inferLastProfile(ctx.paths));
    if (!name) process.exit(1);
    process.exit(await handleUp(ctx.paths, name, { timeout: Number(options.timeout), yes: Boolean(options.yes) }, ctx.mode));
  });

program
  .command('down [profile]')
  .option('--all', 'Disconnect all profiles')
  .option('-f, --force', 'Force disconnect')
  .action(async (profile, options) => {
    const ctx = await context(program.opts());
    process.exit(await handleDown(ctx.paths, options.all ? null : profile ?? null, { force: Boolean(options.force) }, ctx.mode));
  });

program.command('reconnect [profile]').action(async (profile) => {
  const ctx = await context(program.opts());
  process.exit(await handleReconnect(ctx.paths, profile ?? null, ctx.mode));
});

program
  .command('status')
  .option('-w, --watch', 'Watch mode')
  .option('--interval <secs>', 'Watch interval', '2')
  .option('--brief', 'One-line summary')
  .action(async (options) => {
    const ctx = await context(program.opts());
    process.exit(await handleStatus(ctx.paths, { watch: Boolean(options.watch), interval: Number(options.interval), brief: Boolean(options.brief) }, ctx.mode));
  });

program
  .command('list')
  .option('--sort <field>', 'Sort by name|protocol|last-used')
  .option('--reverse', 'Reverse sort order')
  .option('--protocol <name>', 'Filter protocol wireguard|openvpn')
  .option('--names-only', 'Print names only')
  .action(async (options) => {
    const ctx = await context(program.opts());
    process.exit(await handleList(ctx.paths, options, ctx.mode));
  });

program.command('import <fileOrUrl>').action(async (fileOrUrl) => {
  const ctx = await context(program.opts());
  process.exit(await handleImport(ctx.paths, fileOrUrl, ctx.mode));
});

program
  .command('show <profile>')
  .option('--raw', 'Show raw profile text')
  .action(async (profile, options) => {
    const ctx = await context(program.opts());
    process.exit(await handleShow(ctx.paths, profile, options, ctx.mode));
  });

program.command('delete <profile>').action(async (profile) => {
  const ctx = await context(program.opts());
  process.exit(await handleDelete(ctx.paths, profile, ctx.mode));
});

program.command('rename <oldName> <newName>').action(async (oldName, newName) => {
  const ctx = await context(program.opts());
  process.exit(await handleRename(ctx.paths, oldName, newName, ctx.mode));
});

program.command('killswitch [mode]').action(async (modeArg) => {
  const ctx = await context(program.opts());
  process.exit(await handleKillSwitch(ctx.paths, modeArg ?? null, ctx.mode));
});

program.command('release-killswitch').action(async () => {
  const ctx = await context(program.opts());
  process.exit(await handleReleaseKillSwitch(ctx.paths, ctx.mode));
});

program.command('info').action(async () => {
  const opts = program.opts();
  const ctx = await context(opts);
  const source = opts.configDir ? 'from --config-dir' : process.env.VORTIX_CONFIG_DIR ? 'from VORTIX_CONFIG_DIR' : 'default';
  process.exit(await handleInfo(ctx.paths, source, ctx.mode));
});

program.command('audit').option('--pid <pid>').option('--vpn-only').action(async (options) => {
  const ctx = await context(program.opts());
  process.exit(await handleAudit(ctx.paths, { pid: options.pid, vpnOnly: Boolean(options.vpnOnly) }, ctx.mode));
});

program.command('daemon').action(async () => {
  const ctx = await context(program.opts());
  process.exit(await handleDaemon(ctx.mode));
});

program.command('update').action(() => {
  console.log('Run: npm install -g @harry-kp/vortix-node@latest');
  process.exit(0);
});

program.command('report').action(() => {
  console.log('Collect diagnostics with: vortix-node info --json && vortix-node status --json');
  process.exit(0);
});

program.command('completions').argument('<shell>').action((shell) => {
  console.log(`# Completion placeholder for ${shell}.`);
  process.exit(0);
});

async function context(opts) {
  const configDir = resolveConfigDir(opts.configDir);
  await ensureConfigLayout(configDir);
  return {
    paths: layout(configDir),
    mode: { json: Boolean(opts.json), quiet: Boolean(opts.quiet), verbose: Boolean(opts.verbose) },
  };
}

async function inferLastProfile(paths) {
  const profiles = await listProfiles(paths);
  if (profiles.length === 0) {
    console.error('No profiles imported. Use: vortix-node import <file|dir|url>');
    return null;
  }
  return profiles[0].name;
}

if (process.argv.length <= 2) {
  const opts = program.opts();
  const ctx = await context(opts);
  await launchDashboard(ctx.paths);
} else {
  await program.parseAsync(process.argv);
}
