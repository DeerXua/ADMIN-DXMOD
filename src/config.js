import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  // Legacy static token (kept for backward compatibility)
  adminToken: process.env.ADMIN_TOKEN || "change-this-admin-token",
  // JWT
  jwtSecret: process.env.JWT_SECRET || "change-this-jwt-secret",
  // Game client API key (embedded in Lua)
  apiKey: process.env.API_KEY || "DX_API_KEY_2026",
  // Admin login credentials
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "change-this-password",
  // DB
  dbPath: process.env.DB_PATH || "./data/app.json",
  // Rate limiting
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000), // 1 min
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 15),               // 15 req/min per IP
};
