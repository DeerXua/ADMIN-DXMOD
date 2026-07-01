import express from "express";
import jwt from "jsonwebtoken";
import { store, publicDevice } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { config } from "../config.js";

export const adminRouter = express.Router();

// ================================================================
//  POST /api/admin/login
//  Returns a JWT token valid for 24h
// ================================================================
adminRouter.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (
    username !== config.adminUsername ||
    password !== config.adminPassword
  ) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = jwt.sign(
    { username, role: "admin" },
    config.jwtSecret,
    { expiresIn: "24h" }
  );

  return res.json({
    token,
    expiresIn: "24h",
    username,
  });
});

// ================================================================
//  All routes below require admin auth (JWT or legacy static token)
// ================================================================
adminRouter.use(requireAdmin);

// ----------------------------------------------------------------
//  GET /api/admin/users  — list all UIDs (supports ?status=&search=&page=&limit=)
// ----------------------------------------------------------------
adminRouter.get("/users", (req, res) => {
  const status = String(req.query.status || "").trim();
  const search = String(req.query.search || "").trim();
  const page  = Math.max(1, Number(req.query.page  || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

  const all  = store.listDevices(status || undefined, search || undefined);
  const total = all.length;
  const items = all.slice((page - 1) * limit, page * limit);

  return res.json({
    devices: items.map(publicDevice),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ----------------------------------------------------------------
//  Alias: GET /api/admin/devices (legacy frontend compatibility)
// ----------------------------------------------------------------
adminRouter.get("/devices", (req, res) => {
  const status = String(req.query.status || "").trim();
  const rows = store.listDevices(status || undefined);
  return res.json({ devices: rows.map(publicDevice) });
});

// ----------------------------------------------------------------
//  POST /api/admin/users  — add/update a UID directly
// ----------------------------------------------------------------
adminRouter.post("/users", (req, res) => {
  const uid = String(req.body.uid || req.body.gameId || "").trim();
  const expiresAt = req.body.expiresAt
    ? new Date(req.body.expiresAt).toISOString()
    : null;
  const note  = req.body.note  !== undefined ? String(req.body.note  || "").trim() || null : null;
  const label = req.body.label !== undefined ? String(req.body.label || "").trim() || null : null;

  if (!uid || uid.length > 160) {
    return res.status(400).json({ error: "uid is required and must be under 160 characters" });
  }

  const row = store.addUser(uid, expiresAt, note, label);
  return res.status(201).json({ device: publicDevice(row) });
});

// ----------------------------------------------------------------
//  PUT /api/admin/users/:uid  — update by uid string
// ----------------------------------------------------------------
adminRouter.put("/users/:uid", (req, res) => {
  const uid = decodeURIComponent(req.params.uid);
  const row = store.findByGameId(uid);

  if (!row) {
    return res.status(404).json({ error: "UID not found" });
  }

  const status    = req.body.status !== undefined ? String(req.body.status || "").trim() : row.status;
  const expiresAt = req.body.expiresAt !== undefined
    ? (req.body.expiresAt ? new Date(req.body.expiresAt).toISOString() : null)
    : row.expires_at;
  const note  = req.body.note  !== undefined ? String(req.body.note  || "").trim() || null : row.note;
  const label = req.body.label !== undefined ? String(req.body.label || "").trim() || null : row.label;

  if (!["pending", "approved", "blocked"].includes(status)) {
    return res.status(400).json({ error: "status must be pending, approved, or blocked" });
  }

  const updated = store.updateDevice(row.id, { status, expiresAt, note, label });
  return res.json({ device: publicDevice(updated) });
});

// ----------------------------------------------------------------
//  PATCH /api/admin/devices/:id  (legacy — update by numeric id)
// ----------------------------------------------------------------
adminRouter.patch("/devices/:id", (req, res) => {
  const id = Number(req.params.id);
  const status    = String(req.body.status || "").trim();
  const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt).toISOString() : null;
  const note  = req.body.note  === undefined ? undefined : String(req.body.note  || "").trim() || null;
  const label = req.body.label === undefined ? undefined : String(req.body.label || "").trim() || null;

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

  const row = store.updateDevice(id, { status, expiresAt, note, label });
  return res.json({ device: publicDevice(row) });
});

// ----------------------------------------------------------------
//  DELETE /api/admin/users/:uid  (by uid string)
// ----------------------------------------------------------------
adminRouter.delete("/users/:uid", (req, res) => {
  const uid = decodeURIComponent(req.params.uid);
  const row = store.findByGameId(uid);

  if (!row) {
    return res.status(404).json({ error: "UID not found" });
  }

  store.deleteDevice(row.id);
  return res.status(204).send();
});

// ----------------------------------------------------------------
//  DELETE /api/admin/devices/:id  (legacy — by numeric id)
// ----------------------------------------------------------------
adminRouter.delete("/devices/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid device id" });
  }

  store.deleteDevice(id);
  return res.status(204).send();
});

// ----------------------------------------------------------------
//  GET /api/admin/logs  — get recent access logs
// ----------------------------------------------------------------
adminRouter.get("/logs", (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const logs = store.getLogs(limit);
  return res.json({ logs });
});
