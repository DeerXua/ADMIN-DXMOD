import { config } from "./config.js";

export function requireAdmin(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  console.log(`[DEBUG AUTH] Client Token: "${token}"`);
  console.log(`[DEBUG AUTH] Server Configured Token: "${config.adminToken}"`);
  console.log(`[DEBUG AUTH] Match: ${token === config.adminToken}`);

  if (!token || token !== config.adminToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}
