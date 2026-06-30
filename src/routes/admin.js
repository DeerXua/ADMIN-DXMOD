import express from "express";
import { store, publicDevice } from "../db.js";
import { requireAdmin } from "../middleware.js";

export const adminRouter = express.Router();

adminRouter.use(requireAdmin);

adminRouter.get("/devices", (req, res) => {
  const status = String(req.query.status || "").trim();
  const rows = store.listDevices(status);

  return res.json({ devices: rows.map(publicDevice) });
});

adminRouter.patch("/devices/:id", (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || "").trim();
  const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt).toISOString() : null;
  const note = req.body.note === undefined ? undefined : String(req.body.note || "").trim() || null;

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid device id" });
  }

  if (!["pending", "approved", "blocked"].includes(status)) {
    return res.status(400).json({ error: "status must be pending, approved, or blocked" });
  }

  const existing = store.findById(id);
  if (!existing) {
    return res.status(404).json({ error: "Device not found" });
  }

  const row = store.updateDevice(id, { status, expiresAt, note });
  return res.json({ device: publicDevice(row) });
});

adminRouter.delete("/devices/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid device id" });
  }

  store.deleteDevice(id);
  return res.status(204).send();
});
