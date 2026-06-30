import express from "express";
import { store } from "../db.js";

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
