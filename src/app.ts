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
import { notFound, errorHandler } from "./middleware/errorHandler";
 
const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression() as any);
app.use(
  cors({
    origin: [
       "http://localhost:3000", 
      "http://localhost:5173",
       "https://the-love-box-customer.vercel.app",
       "https://the-love-box-admin.vercel.app",
      ],
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Try again shortly." },
});
app.use("/api", apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Try again in a few minutes." },
});
app.use("/api/auth", authLimiter);

app.get("/api/health", (req, res) => res.json({ ok: true, service: "theloveboxgifts-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/search", searchRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
