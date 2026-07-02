import express from "express";
import { rateLimit } from "express-rate-limit";
import { store, isDeviceActive } from "../db.js";
import { requireApiKey } from "../middleware.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// XOR key must match the key used in game stub
const XOR_KEY = "DX_SECRET_KEY_2026_@#$";

// Path to the protected Lua script
const SCRIPT_PATH = path.join(__dirname, "..", "..", "protected_script.lua");

export const publicRouter = express.Router();

// ----------------------------------------------------------------
//  Rate limiter: 120 requests per minute per IP (generous for polling)
// ----------------------------------------------------------------
const checkLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: "Too many requests, please slow down" },
});

// ----------------------------------------------------------------
//  HELPERS
// ----------------------------------------------------------------
function normalizeGameId(value) {
  return String(value || "").trim();
}

function isActive(row) {
  if (!row || row.status !== "approved") return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

function encryptXOR(plaintext) {
  const data = Buffer.from(plaintext, "utf8");
  const key = Buffer.from(XOR_KEY, "utf8");
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result.toString("hex");
}

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// ================================================================
//  ENDPOINT: POST /api/check
//  Game client calls this with { uid, apiKey }
//  Returns { status, active, expire_time, message }
// ================================================================
publicRouter.post("/check", checkLimiter, requireApiKey, (req, res) => {
  const uid = normalizeGameId(req.body.uid || req.body.gameId);

  if (!uid) {
    return res.status(400).json({
      status: "error",
      active: false,
      expire_time: null,
      message: "uid is required",
    });
  }

  const ip = getClientIp(req);
  let row = store.findByGameId(uid);

  // Auto-register if not found (status = pending, NOT approved)
  if (!row) {
    row = store.registerDevice(uid, null);
  } else {
    store.touchDevice(uid);
  }

  const active = isActive(row);
  
  let logStatus = "pending";
  if (row) {
    if (row.status === "blocked") {
      logStatus = "blocked";
    } else if (row.status === "approved") {
      if (active) {
        logStatus = "approved";
      } else {
        logStatus = "expired";
      }
    } else {
      logStatus = "pending";
    }
  }
  
  store.addLog(uid, ip, logStatus, "check");

  if (!active) {
    const reason =
      row.status === "blocked"
        ? "UID đã bị chặn / UID is blocked"
        : row.status === "pending"
        ? "UID chưa được kích hoạt / UID pending activation"
        : "Giấy phép đã hết hạn / License expired";

    return res.json({
      status: "error",
      active: false,
      expire_time: row.expires_at || null,
      message: reason,
    });
  }

  return res.json({
    status: "success",
    active: true,
    expire_time: row.expires_at || null,
    message: "Kích hoạt thành công / Activated",
  });
});

// ================================================================
//  ENDPOINT: GET /api/check (convenience — same logic, GET variant)
// ================================================================
publicRouter.get("/check", checkLimiter, (req, res) => {
  const uid = normalizeGameId(req.query.uid || req.query.gameId);

  if (!uid) {
    return res.status(400).json({ status: "error", active: false, message: "uid required" });
  }

  const ip = getClientIp(req);
  let row = store.findByGameId(uid);
  if (!row) row = store.registerDevice(uid, null);
  else store.touchDevice(uid);

  const active = isActive(row);
  
  let logStatus = "pending";
  if (row) {
    if (row.status === "blocked") {
      logStatus = "blocked";
    } else if (row.status === "approved") {
      if (active) {
        logStatus = "approved";
      } else {
        logStatus = "expired";
      }
    } else {
      logStatus = "pending";
    }
  }

  store.addLog(uid, ip, logStatus, "check-get");

  return res.json({
    status: active ? "success" : "error",
    active,
    expire_time: row.expires_at || null,
    message: active ? "Activated" : "Not activated",
  });
});

// ================================================================
//  ENDPOINT: POST /api/load-script  (serve XOR-encrypted Lua)
// ================================================================
publicRouter.post("/load-script", (req, res) => {
  const gameId = normalizeGameId(req.body.gameId || req.headers["x-game-id"]);

  if (!gameId) {
    return res.status(400).json({ error: "gameId is required" });
  }

  let device = store.findByGameId(gameId);
  if (!device) {
    device = store.registerDevice(gameId, "Auto Registered & Approved via Game");
  }

  if (device.status !== "approved") {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    device = store.updateDevice(device.id, {
      status: "approved",
      expiresAt: thirtyDaysFromNow.toISOString(),
      note: "Auto Approved for Testing",
    });
  }

  if (!fs.existsSync(SCRIPT_PATH)) {
    return res.status(404).json({ error: "Script not found on server" });
  }

  store.touchDevice(gameId);

  fs.readFile(SCRIPT_PATH, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Failed to read script" });
    const encryptedData = encryptXOR(data);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.end(encryptedData);
  });
});

// ================================================================
//  ENDPOINT: GET /api/load-script  (query param variant)
// ================================================================
publicRouter.get("/load-script", (req, res) => {
  const gameId = normalizeGameId(req.query.gameId);

  if (!gameId) {
    return res.status(400).json({ error: "gameId is required" });
  }

  let device = store.findByGameId(gameId);
  if (!device) {
    device = store.registerDevice(gameId, "Auto Registered & Approved via Game");
  }

  if (device.status !== "approved") {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    device = store.updateDevice(device.id, {
      status: "approved",
      expiresAt: thirtyDaysFromNow.toISOString(),
      note: "Auto Approved for Testing",
    });
  }

  if (!fs.existsSync(SCRIPT_PATH)) {
    return res.status(404).json({ error: "Script not found on server" });
  }

  store.touchDevice(gameId);

  fs.readFile(SCRIPT_PATH, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Failed to read script" });
    const encryptedData = encryptXOR(data);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.end(encryptedData);
  });
});

// ================================================================
//  ENDPOINT: POST /api/devices/register  (legacy)
// ================================================================
publicRouter.post("/devices/register", (req, res) => {
  const gameId = normalizeGameId(req.body.gameId);
  const label = String(req.body.label || "").trim() || null;

  if (!gameId || gameId.length > 160) {
    return res.status(400).json({ error: "gameId is required and must be under 160 characters" });
  }

  const row = store.registerDevice(gameId, label);

  return res.json({
    gameId,
    status: row.status,
    active: isActive(row),
    expiresAt: row.expires_at,
  });
});

// ================================================================
//  ENDPOINT: GET /api/licenses/check  (legacy)
// ================================================================
publicRouter.get("/licenses/check", (req, res) => {
  const gameId = normalizeGameId(req.query.gameId);

  if (!gameId) {
    return res.status(400).json({ error: "gameId is required" });
  }

  const existing = store.findByGameId(gameId);
  if (!existing) {
    return res.json({ gameId, status: "unknown", active: false, expiresAt: null });
  }

  const row = store.touchDevice(gameId);

  return res.json({
    gameId,
    status: row.status,
    active: isActive(row),
    expiresAt: row.expires_at,
  });
});
