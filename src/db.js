import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const dbDir = path.dirname(config.dbPath);
fs.mkdirSync(dbDir, { recursive: true });

function readState() {
  if (!fs.existsSync(config.dbPath)) {
    return { nextId: 1, devices: [] };
  }

  try {
    const raw = fs.readFileSync(config.dbPath, "utf8").trim();
    if (!raw) {
      return { nextId: 1, devices: [] };
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse database file, resetting to empty state:", err);
    return { nextId: 1, devices: [] };
  }
}

function writeState(state) {
  const tempPath = `${config.dbPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
  fs.renameSync(tempPath, config.dbPath);
}

export const store = {
  listDevices(status) {
    const state = readState();
    return state.devices
      .filter((device) => !status || device.status === status)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  },

  findById(id) {
    const state = readState();
    return state.devices.find((device) => device.id === id) || null;
  },

  findByGameId(gameId) {
    const state = readState();
    return state.devices.find((device) => device.game_id === gameId) || null;
  },

  registerDevice(gameId, label) {
    const state = readState();
    const timestamp = nowIso();
    let device = state.devices.find((item) => item.game_id === gameId);

    if (device) {
      if (label) device.label = label;
      device.last_seen_at = timestamp;
      device.updated_at = timestamp;
    } else {
      device = {
        id: state.nextId,
        game_id: gameId,
        label,
        status: "pending",
        expires_at: null,
        note: null,
        first_seen_at: timestamp,
        last_seen_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp
      };
      state.nextId += 1;
      state.devices.push(device);
    }

    writeState(state);
    return device;
  },

  touchDevice(gameId) {
    const state = readState();
    const device = state.devices.find((item) => item.game_id === gameId);
    if (!device) return null;

    const timestamp = nowIso();
    device.last_seen_at = timestamp;
    device.updated_at = timestamp;
    writeState(state);
    return device;
  },

  updateDevice(id, values) {
    const state = readState();
    const device = state.devices.find((item) => item.id === id);
    if (!device) return null;

    device.status = values.status;
    device.expires_at = values.expiresAt;
    if (values.note !== undefined) device.note = values.note;
    device.updated_at = nowIso();
    writeState(state);
    return device;
  },

  deleteDevice(id) {
    const state = readState();
    const before = state.devices.length;
    state.devices = state.devices.filter((device) => device.id !== id);
    writeState(state);
    return state.devices.length !== before;
  }
};

export function nowIso() {
  return new Date().toISOString();
}

export function publicDevice(row) {
  if (!row) return null;
  return {
    id: row.id,
    gameId: row.game_id,
    label: row.label,
    status: row.status,
    expiresAt: row.expires_at,
    note: row.note,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
