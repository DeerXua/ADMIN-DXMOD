import express from "express";
import { store } from "../db.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Khóa XOR bí mật (trùng khớp với khóa trong game stub)
const XOR_KEY = "DX_SECRET_KEY_2026_@#$";

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
// Phuc vu noi dung protected_script.lua cho game client
// Game stub se goi POST den day de tai mod code ve chay
// ================================================================
publicRouter.post("/load-script", (req, res) => {
  if (!fs.existsSync(SCRIPT_PATH)) {
    return res.status(404).json({ error: "Script not found on server" });
  }

  fs.readFile(SCRIPT_PATH, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read script" });
    }
    
    // Ma hoa noi dung va gui di
    const encryptedData = encryptXOR(data);
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.end(encryptedData);
  });
});

// ENDPOINT: GET /api/load-script (ho tro ca GET de test)
publicRouter.get("/load-script", (req, res) => {
  if (!fs.existsSync(SCRIPT_PATH)) {
    return res.status(404).json({ error: "Script not found on server" });
  }

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

// END OF FILE
