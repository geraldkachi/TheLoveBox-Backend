import mongoose from "mongoose";
import { logger } from "../utils/logger";

let connecting: Promise<typeof mongoose> | null = null;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in .env");
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  mongoose.set("strictQuery", true);
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));
  mongoose.connection.on("error", (err) => logger.error("MongoDB error", { error: err.message }));

  connecting = mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 });
  try {
    await connecting;
    logger.info("MongoDB connected");
    return mongoose;
  } finally {
    connecting = null;
  }
}

const STATES: Record<number, string> = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
export const dbState = () => STATES[mongoose.connection.readyState as number] || "unknown";
