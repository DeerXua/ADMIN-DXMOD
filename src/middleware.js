import { config } from "./config.js";

export function requireAdmin(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || token !== config.adminToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}
