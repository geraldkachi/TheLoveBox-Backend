import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Order from "../models/Order";
import Product from "../models/Product";
import Category from "../models/Category";
import { ok } from "../utils/respond";

const PAID = ["paid", "processing", "out_for_delivery", "delivered"];

/** GET /stats/overview?days=7|30|90 — real numbers for the admin dashboard. */
export const overview = asyncHandler(async (req: Request, res: Response) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - days);

  const [revenueAll, revenueWindow, revenuePrev, daily, byStatus, recent, topProducts, productCount, activeProducts, lowStock, categoryCount] =
    await Promise.all([
      Order.aggregate([{ $match: { status: { $in: PAID } } }, { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: { $in: PAID }, createdAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { status: { $in: PAID }, createdAt: { $gte: prevSince, $lt: since } } },
        { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { status: { $in: PAID }, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Africa/Lagos" } },
            revenue: { $sum: "$total" },
            orders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.find().sort({ createdAt: -1 }).limit(6).select("orderNumber customer.name total status createdAt").lean(),
      Order.aggregate([
        { $match: { status: { $in: PAID } } },
        { $unwind: "$items" },
        { $group: { _id: "$items.product", name: { $first: "$items.name" }, image: { $first: "$items.image" }, qty: { $sum: "$items.qty" }, revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.find({ isActive: true, stock: { $lte: 3 } }).select("name stock images").limit(5).lean(),
      Category.countDocuments(),
    ]);

  // Fill every day so the chart has no gaps
  const map = new Map(daily.map((d: any) => [d._id, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
    const hit: any = map.get(key);
    return { date: key, revenue: hit?.revenue || 0, orders: hit?.orders || 0 };
  });

  const cur = revenueWindow[0]?.total || 0;
  const prev = revenuePrev[0]?.total || 0;
  const change = prev ? ((cur - prev) / prev) * 100 : cur ? 100 : 0;

  ok(res, {
    days,
    revenue: { allTime: revenueAll[0]?.total || 0, window: cur, previous: prev, changePct: Math.round(change * 10) / 10 },
    orders: {
      paidAllTime: revenueAll[0]?.count || 0,
      window: revenueWindow[0]?.count || 0,
      byStatus: Object.fromEntries(byStatus.map((s: any) => [s._id, s.count])),
    },
    averageOrderValue: revenueWindow[0]?.count ? Math.round(cur / revenueWindow[0].count) : 0,
    products: { total: productCount, active: activeProducts, lowStock },
    categories: categoryCount,
    series,
    recentOrders: recent,
    topProducts,
  });
});
