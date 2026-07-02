import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const dbDir = path.dirname(config.dbPath);
fs.mkdirSync(dbDir, { recursive: true });

// ================================================================
//  STATE HELPERS
// ================================================================
function readState() {
  if (!fs.existsSync(config.dbPath)) {
    return { nextId: 1, devices: [], logs: [] };
  }
  try {
    const raw = fs.readFileSync(config.dbPath, "utf8").trim();
    if (!raw) return { nextId: 1, devices: [], logs: [] };
    const state = JSON.parse(raw);
    if (!state.logs) state.logs = [];          // migrate older dbs
    return state;
  } catch (err) {
    console.error("Failed to parse database file, resetting:", err);
    return { nextId: 1, devices: [], logs: [] };
  }
}

function writeState(state) {
  const tempPath = `${config.dbPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
  fs.renameSync(tempPath, config.dbPath);
}

export function nowIso() {
  return new Date().toISOString();
}

// ================================================================
//  HELPERS
// ================================================================
function isDeviceActive(row) {
  if (!row || row.status !== "approved") return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

// ================================================================
//  PUBLIC DEVICE SERIALISER
// ================================================================
export function publicDevice(row) {
  if (!row) return null;
  return {
    id: row.id,
    gameId: row.game_id,
    uid: row.game_id,       // alias for new API
    label: row.label,
    status: row.status,
    active: isDeviceActive(row),
    expiresAt: row.expires_at,
    note: row.note,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ================================================================
//  STORE
// ================================================================
export const store = {
  // ---- READ ----
  listDevices(status, search) {
    const state = readState();
    return state.devices
      .filter((d) => !status || d.status === status)
      .filter((d) => !search || d.game_id.includes(search) || (d.label || "").toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  },

  findById(id) {
    const state = readState();
    return state.devices.find((d) => d.id === id) || null;
  },

  findByGameId(gameId) {
    const state = readState();
    return state.devices.find((d) => d.game_id === gameId) || null;
  },

  // ---- WRITE ----
  registerDevice(gameId, label) {
    const state = readState();
    const timestamp = nowIso();
    let device = state.devices.find((d) => d.game_id === gameId);

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
        updated_at: timestamp,
      };
      state.nextId += 1;
      state.devices.push(device);
    }

    writeState(state);
    return device;
  },

  /** Add (or update) a user by UID directly — for admin POST /users */
  addUser(gameId, expiresAt, note, label) {
    const state = readState();
    const timestamp = nowIso();
    let device = state.devices.find((d) => d.game_id === gameId);

    if (device) {
      // Update existing
      device.status = "approved";
      device.expires_at = expiresAt || null;
      if (note !== undefined) device.note = note;
      if (label !== undefined) device.label = label;
      device.updated_at = timestamp;
    } else {
      device = {
        id: state.nextId,
        game_id: gameId,
        label: label || null,
        status: "approved",
        expires_at: expiresAt || null,
        note: note || null,
        first_seen_at: timestamp,
        last_seen_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
      };
      state.nextId += 1;
      state.devices.push(device);
    }

    writeState(state);
    return device;
  },

  touchDevice(gameId) {
    const state = readState();
    const device = state.devices.find((d) => d.game_id === gameId);
    if (!device) return null;

    const timestamp = nowIso();
    device.last_seen_at = timestamp;
    device.updated_at = timestamp;
    writeState(state);
    return device;
  },

  updateDevice(id, values) {
    const state = readState();
    const device = state.devices.find((d) => d.id === id);
    if (!device) return null;

    device.status = values.status;
    device.expires_at = values.expiresAt;
    if (values.note !== undefined) device.note = values.note;
    if (values.label !== undefined) device.label = values.label;
    device.updated_at = nowIso();
    writeState(state);
    return device;
  },

  deleteDevice(id) {
    const state = readState();
    const before = state.devices.length;
    state.devices = state.devices.filter((d) => d.id !== id);
    writeState(state);
    return state.devices.length !== before;
  },

  // ---- ACCESS LOGS ----
  /** Record every /api/check call */
  addLog(uid, ip, status, method) {
    const state = readState();
    state.logs.unshift({
      uid,
      ip: ip || "unknown",
      status: status || "pending",
      method: method || "check",
      timestamp: nowIso(),
    });
    // Keep only last 500 logs
    if (state.logs.length > 500) state.logs = state.logs.slice(0, 500);
    writeState(state);
  },

  getLogs(limit) {
    const state = readState();
    return state.logs.slice(0, limit || 50);
  },
};

// Convenience: check active status for a row
export { isDeviceActive };
