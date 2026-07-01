import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { publicRouter } from "./routes/public.js";
import { adminRouter } from "./routes/admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security headers (CSP disabled for our simple frontend)
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "64kb" }));

// Global rate limit (generous — per-endpoint limits are stricter)
app.use(rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
}));

// Request logger
app.use((req, res, next) => {
  const uid = req.headers["x-game-id"] || req.body?.uid || req.body?.gameId || req.query.gameId || "N/A";
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${req.ip} - UID: ${uid}`);
  next();
});

// Health check
app.get("/health", (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Routes
app.use("/api", publicRouter);
app.use("/api/admin", adminRouter);

// Serve frontend static files
app.use(express.static(path.join(__dirname, "..", "public")));

// SPA fallback — serve index.html for any unknown route
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(config.port, () => {
  console.log(`✅ ADMIN-DXMOD server running on http://localhost:${config.port}`);
  console.log(`   Admin panel: http://localhost:${config.port}/`);
  console.log(`   API check:   POST http://localhost:${config.port}/api/check`);
});
