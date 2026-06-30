import express from "express";
import { store } from "../db.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Duong dan den protected_script.lua (dat o thu muc goc ADMIN-DXMOD)
const SCRIPT_PATH = path.join(__dirname, "..", "..", "protected_script.lua");

export const publicRouter = express.Router();

function normalizeMachineId(value) {
  return String(value || "").trim();
}

function isActive(row) {
  if (!row || row.status !== "approved") return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

publicRouter.post("/devices/register", (req, res) => {
  const machineId = normalizeMachineId(req.body.machineId);
  const label = String(req.body.label || "").trim() || null;

  if (!machineId || machineId.length > 160) {
    return res.status(400).json({ error: "machineId is required and must be under 160 characters" });
  }

  const row = store.registerDevice(machineId, label);

  return res.json({
    machineId,
    status: row.status,
    active: isActive(row),
    expiresAt: row.expires_at
  });
});

publicRouter.get("/licenses/check", (req, res) => {
  const machineId = normalizeMachineId(req.query.machineId);

  if (!machineId) {
    return res.status(400).json({ error: "machineId is required" });
  }

  const existing = store.findByMachineId(machineId);

  if (!existing) {
    return res.json({ machineId, status: "unknown", active: false, expiresAt: null });
  }

  const row = store.touchDevice(machineId);

  return res.json({
    machineId,
    status: row.status,
    active: isActive(row),
    expiresAt: row.expires_at
  });
});

// ================================================================
// ENDPOINT: POST /api/load-script
// Phuc vu noi dung protected_script.lua cho game client
// Game stub se goi POST den day de tai mod code ve chay
// ================================================================
publicRouter.post("/load-script", (req, res) => {
  // Kiem tra file ton tai
  if (!fs.existsSync(SCRIPT_PATH)) {
    return res.status(404).json({ error: "Script not found on server" });
  }

  // Doc noi dung script
  fs.readFile(SCRIPT_PATH, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read script" });
    }
    // Tra ve noi dung Lua thuan
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.end(data);
  });
});

// ENDPOINT: GET /api/load-script (ho tro ca GET cho de test)
publicRouter.get("/load-script", (req, res) => {
  if (!fs.existsSync(SCRIPT_PATH)) {
    return res.status(404).json({ error: "Script not found on server" });
  }

  fs.readFile(SCRIPT_PATH, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read script" });
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.end(data);
  });
});
