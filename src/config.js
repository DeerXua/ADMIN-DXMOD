import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  adminToken: process.env.ADMIN_TOKEN || "change-this-admin-token",
  dbPath: process.env.DB_PATH || "./data/app.sqlite"
};
