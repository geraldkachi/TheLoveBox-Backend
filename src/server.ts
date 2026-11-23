import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

// Some networks can't resolve MongoDB SRV records with the default resolver.
// Override with DNS_SERVERS="1.1.1.1,8.8.8.8" or set DNS_SERVERS="system" to skip.
const dnsServers = process.env.DNS_SERVERS ?? "8.8.8.8,8.8.4.4";
if (dnsServers !== "system") {
  try {
    dns.setServers(dnsServers.split(",").map((s) => s.trim()).filter(Boolean));
  } catch {
    /* fall back to system DNS */
  }
}

import mongoose from "mongoose";
import app from "./app";
import { connectDB } from "./config/db";
import { validateEnv } from "./config/env";
import { logger } from "./utils/logger";

const PORT = Number(process.env.PORT) || 5000;

process.on("unhandledRejection", (reason: any) => {
  logger.error("Unhandled promise rejection", { error: reason?.message || String(reason), stack: reason?.stack });
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception — shutting down", { error: err.message, stack: err.stack });
  process.exit(1);
});

async function start() {
  validateEnv();
  await connectDB();
  const server = app.listen(PORT, () => logger.info(`API running on port ${PORT}`));

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — closing server`);
    server.close(async () => {
      await mongoose.connection.close().catch(() => null);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error("Failed to start API", { error: err.message });
  process.exit(1);
});
