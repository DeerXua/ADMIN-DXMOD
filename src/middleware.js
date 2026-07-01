import jwt from "jsonwebtoken";
import { config } from "./config.js";

// ================================================================
//  JWT ADMIN AUTH (for /api/admin/* routes)
// ================================================================
export function requireAdmin(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: no token" });
  }

  // Support both legacy static token AND JWT
  if (token === config.adminToken) {
    req.adminUser = { username: "admin", legacy: true };
    return next();
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.adminUser = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: invalid or expired token" });
  }
}

// ================================================================
//  API KEY CHECK (for game client /api/check calls from Lua)
// ================================================================
export function requireApiKey(req, res, next) {
  const key = req.body?.apiKey || req.headers["x-api-key"] || req.query.apiKey || "";
  if (key !== config.apiKey) {
    return res.status(403).json({ error: "Forbidden: invalid API key" });
  }
  return next();
}
