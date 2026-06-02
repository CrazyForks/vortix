import { EXIT_CODE, STATUS_SCHEMA_VERSION } from '../constants.js';

function mapCode(code) {
  switch (code) {
    case 'not_found':
      return EXIT_CODE.NOT_FOUND;
    case 'state_conflict':
      return EXIT_CODE.STATE_CONFLICT;
    case 'dependency_missing':
      return EXIT_CODE.DEPENDENCY;
    case 'permission_denied':
      return EXIT_CODE.PERMISSION;
    case 'timeout':
      return EXIT_CODE.TIMEOUT;
    default:
      return EXIT_CODE.GENERAL;
  }
}

export function emit(mode, command, ok, payload, error = null, nextActions = []) {
  if (mode.quiet) return ok ? EXIT_CODE.OK : mapCode(error?.code);

  if (mode.json) {
    const envelope = {
      ok,
      schema_version: STATUS_SCHEMA_VERSION,
      command,
      data: payload,
      error,
      next_actions: nextActions,
      timestamp: new Date().toISOString(),
    };
    process.stdout.write(`${JSON.stringify(envelope)}\n`);
    return ok ? EXIT_CODE.OK : mapCode(error?.code);
  }

  if (ok) {
    if (typeof payload === 'string') {
      console.log(payload);
    } else {
      console.log(JSON.stringify(payload, null, 2));
    }
    return EXIT_CODE.OK;
  }

  console.error(error?.message ?? 'Unknown error');
  return mapCode(error?.code);
}
