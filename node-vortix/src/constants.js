export const EXIT_CODE = {
  OK: 0,
  GENERAL: 1,
  PERMISSION: 2,
  NOT_FOUND: 3,
  STATE_CONFLICT: 4,
  DEPENDENCY: 5,
  TIMEOUT: 6,
};

export const KILLSWITCH_MODES = new Set(["off", "block-on-drop", "vpn-only"]);

export const STATUS_SCHEMA_VERSION = 2;
