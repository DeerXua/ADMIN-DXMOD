import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { publicRouter } from "./routes/public.js";
import { adminRouter } from "./routes/admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api", publicRouter);
app.use("/api/admin", adminRouter);
app.use(express.static(path.join(__dirname, "..", "public")));

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(config.port, () => {
  console.log(`ADMIN-DXMOD server listening on http://localhost:${config.port}`);
});
