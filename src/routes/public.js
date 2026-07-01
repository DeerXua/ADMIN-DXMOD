import express from "express";
import { store } from "../db.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Khóa XOR bí mật (trùng khớp với khóa trong game stub)
const XOR_KEY = "DX_SECRET_KEY_2026_@#$";

// Duong dan den protected_script.lua (trong thu muc ADMIN-DXMOD)
const SCRIPT_PATH = path.join(__dirname, "..", "protected_script.lua");

export const publicRouter = express.Router();

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
  
  // Tra ve chuoi hex de truyen tai an toan qua HTTP thong thuong
  return result.toString("hex");
}

// ================================================================
// ENDPOINT: POST /api/load-script
// Phuc vu noi dung protected_script.lua cho game client co ban quyen
// ================================================================
publicRouter.post("/load-script", (req, res) => {
  const gameId = normalizeGameId(req.body.gameId || req.headers["x-game-id"]);

  if (!gameId) {
    return res.status(400).json({ error: "gameId is required" });
  }

  // Tìm thông tin người chơi trong Database
  let device = store.findByGameId(gameId);

  // Nếu chưa tồn tại hoặc chưa approved, tự động duyệt (Auto-Approve để test)
  if (!device) {
    device = store.registerDevice(gameId, "Auto Registered & Approved via Game");
  }
  
  if (device.status !== "approved") {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    device = store.updateDevice(device.id, {
      status: "approved",
      expiresAt: thirtyDaysFromNow.toISOString(),
      note: "Auto Approved for Testing"
    });
  }

  if (!fs.existsSync(SCRIPT_PATH)) {
    return res.status(404).json({ error: "Script not found on server" });
  }

  // Cập nhật thời gian tương tác cuối
  store.touchDevice(gameId);

  fs.readFile(SCRIPT_PATH, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read script" });
    }
    
    const encryptedData = encryptXOR(data);
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.end(encryptedData);
  });
});

// ENDPOINT: GET /api/load-script (Hỗ trợ truyền gameId qua query param để test)
publicRouter.get("/load-script", (req, res) => {
  const gameId = normalizeGameId(req.query.gameId);

  if (!gameId) {
    return res.status(400).json({ error: "gameId is required" });
  }

  let device = store.findByGameId(gameId);

  // Nếu chưa tồn tại hoặc chưa approved, tự động duyệt (Auto-Approve để test)
  if (!device) {
    device = store.registerDevice(gameId, "Auto Registered & Approved via Game");
  }

  if (device.status !== "approved") {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    device = store.updateDevice(device.id, {
      status: "approved",
      expiresAt: thirtyDaysFromNow.toISOString(),
      note: "Auto Approved for Testing"
    });
  }

  if (!fs.existsSync(SCRIPT_PATH)) {
    return res.status(404).json({ error: "Script not found on server" });
  }

  store.touchDevice(gameId);

  fs.readFile(SCRIPT_PATH, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read script" });
    }
    
    const encryptedData = encryptXOR(data);
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.end(encryptedData);
  });
});


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
    expiresAt: row.expires_at
  });
});

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
    expiresAt: row.expires_at
  });
});

// END OF FILE
