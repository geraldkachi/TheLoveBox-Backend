import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import productRoutes from "./routes/productRoutes";
import orderRoutes from "./routes/orderRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import searchRoutes from "./routes/searchRoutes";
import statsRoutes from "./routes/statsRoutes";
import contactRoutes from "./routes/contactRoutes";
import discountRoutes from "./routes/discountRoutes";
import curateRoutes from "./routes/curateRoutes";
import { notFound, errorHandler } from "./middleware/errorHandler";
import { requestId } from "./middleware/requestId";
import { config } from "./config/env";
import { connectDB, dbState } from "./config/db";
import { AppError } from "./utils/AppError";

const app = express();

app.set("trust proxy", 1); // correct client IPs behind Vercel / proxies (rate limiting)
app.disable("x-powered-by");

app.use(requestId);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression() as any);
app.use(
  cors({
    origin(origin, cb) {
      // allow server-to-server (no origin), listed apps, and Vercel preview URLs for this project
      if (!origin || config.corsOrigins.includes(origin) || /^https:\/\/the-love-box-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
        return cb(null, true);
      }
      cb(new AppError(403, "This site isn't allowed to call the API.", "CORS_BLOCKED"));
    },
    credentials: true,
    exposedHeaders: ["X-Request-Id"],
  })
);

// Keep the raw body so the Paystack webhook signature can be verified
app.use(
  express.json({
    limit: "2mb",
    verify: (req: any, _res, buf) => {
      if (req.originalUrl?.startsWith("/api/payments/webhook")) req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const limiterMessage = (message: string) => ({ success: false, code: "RATE_LIMITED", message });

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith("/payments/webhook"),
    message: limiterMessage("Too many requests. Please slow down and try again shortly."),
  })
);
app.use(
  ["/api/auth/login", "/api/auth/register"],
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: limiterMessage("Too many sign-in attempts. Please wait a few minutes and try again."),
  })
);

app.get("/api/health", (_req, res) =>
  res.status(dbState() === "connected" ? 200 : 503).json({
    success: dbState() === "connected",
    service: "theloveboxgifts-api",
    db: dbState(),
    uptime: Math.round(process.uptime()),
  })
);

// Serverless cold starts: make sure the DB is connected before handling a request
app.use("/api", async (_req, _res, next) => {
  try {
    if (dbState() !== "connected") await connectDB();
    next();
  } catch {
    next(new AppError(503, "We're having trouble reaching our database. Please try again in a moment.", "DB_UNAVAILABLE"));
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/curate", curateRoutes);
app.use("/api", contactRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
