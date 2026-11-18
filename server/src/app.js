const express = require("express");
const cors = require("cors");

const registerNotificationsRoutes = require("./routes/notifications.routes");
const registerAuthRoutes = require("./routes/auth.routes");
const registerCommentsRoutes = require("./routes/comments.routes");
const registerBookmarksRoutes = require("./routes/bookmarks.routes");
const registerPostsRoutes = require("./routes/posts.routes");
const registerFollowsRoutes = require("./routes/follows.routes");
const registerUsersRoutes = require("./routes/users.routes");
const registerSearchRoutes = require("./routes/search.routes");
const registerHealthRoutes = require("./routes/health.routes");
const registerAccountRoutes = require("./routes/account.routes");
const registerDiscoveryRoutes = require("./routes/discovery.routes");

function createApp(deps) {
  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000")
    .split(",").map((origin) => origin.trim()).filter(Boolean);
  const isProduction = process.env.NODE_ENV === "production";

  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (isProduction) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // Process-local fallback limiter. For multi-instance production deployments,
  // replace the store with a shared Redis-backed limiter.
  const buckets = new Map();
  const rateLimit = ({ windowMs, max, keyPrefix }) => (req, res, next) => {
    const key = `${keyPrefix}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs };
    entry.count += 1;
    buckets.set(key, entry);
    if (buckets.size > 10000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > max) return res.status(429).json({ error: "Too many requests. Please try again later." });
    next();
  };
  app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "login" }));
  app.use("/api/auth/register", rateLimit({ windowMs: 60 * 60 * 1000, max: 8, keyPrefix: "register" }));
  app.use("/api/auth/forgot-password", rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: "forgot" }));
  app.use("/api/auth/refresh", rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: "refresh" }));
  app.use("/api/search", rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "search" }));

  // Register the feature modules.
  registerNotificationsRoutes(app, deps);
  registerAuthRoutes(app, deps);
  registerCommentsRoutes(app, deps);
  registerBookmarksRoutes(app, deps);
  
  // Register specific post routes before dynamic slug routes.
  registerDiscoveryRoutes(app, deps);
  registerPostsRoutes(app, deps);
  
  registerFollowsRoutes(app, deps);
  registerUsersRoutes(app, deps);
  registerAccountRoutes(app, deps);
  registerSearchRoutes(app, deps);
  registerHealthRoutes(app, deps);

  app.use((req, res) => res.status(404).json({ error: "Route not found" }));
  app.use((err, req, res, next) => {
    if (err && err.message === "Origin is not allowed by CORS") {
      return res.status(403).json({ error: "Origin not allowed" });
    }
    if (err && err.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large" });
    console.error("Unhandled server error:", err);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}

module.exports = createApp;
