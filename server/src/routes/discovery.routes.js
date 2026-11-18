// Additive feed/discovery APIs. Legacy /api/posts remains unchanged for compatibility.
const TTLCache = require("../utils/ttl-cache");
const publicAggregateCache = new TTLCache({ ttlMs: 60_000, maxEntries: 100 });

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (!parsed || !Number.isFinite(Date.parse(parsed.createdAt)) || !Number.isInteger(Number(parsed.id))) return null;
    return { createdAt: new Date(parsed.createdAt).toISOString(), id: Number(parsed.id) };
  } catch { return null; }
}
function encodeCursor(row) {
  if (!row) return null;
  return Buffer.from(JSON.stringify({ createdAt: row.createdAt, id: row.id })).toString("base64url");
}

module.exports = function registerDiscoveryRoutes(app, deps) {
  const { pool, POST_SELECT, optionalAuthenticateToken } = deps;

  app.get("/api/posts/feed", optionalAuthenticateToken, async (req, res) => {
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
    const cursor = decodeCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ error: "Invalid feed cursor" });
    const userId = Number.isInteger(Number(req.user?.id)) ? Number(req.user.id) : null;
    try {
      const result = await pool.query(
        `${POST_SELECT}
         WHERE p.published_at IS NOT NULL
           AND ($1::int IS NULL OR NOT EXISTS (
             SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id) OR (b.blocker_id = p.user_id AND b.blocked_id = $1)
           ))
           AND (p.user_id = $1 OR NOT EXISTS (SELECT 1 FROM users pu WHERE pu.id = p.user_id AND pu.is_private = TRUE)
             OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = p.user_id))
           AND ($2::timestamptz IS NULL OR (p.created_at, p.id) < ($2::timestamptz, $3::int))
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT $4`,
        [userId, cursor?.createdAt || null, cursor?.id || null, limit + 1]
      );
      const hasMore = result.rows.length > limit;
      const posts = result.rows.slice(0, limit);
      return res.json({ posts, hasMore, nextCursor: hasMore ? encodeCursor(posts[posts.length - 1]) : null });
    } catch (error) {
      console.error("Paginated feed error:", error);
      return res.status(500).json({ error: "Unable to load feed" });
    }
  });

  app.get("/api/posts/discover", optionalAuthenticateToken, async (req, res) => {
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const offset = (page - 1) * limit;
    const category = String(req.query.category || "").trim().slice(0, 60);
    const tag = String(req.query.tag || "").trim().replace(/^#/, "").slice(0, 40);
    const requestedSort = String(req.query.sort || "trending");
    const sort = ["latest", "most-read", "most-liked", "trending"].includes(requestedSort) ? requestedSort : "trending";
    const query = String(req.query.q || "").trim().slice(0, 100);
    const searchPattern = `%${query}%`;
    const userId = Number.isInteger(Number(req.user?.id)) ? Number(req.user.id) : null;
    try {
      const order = sort === "latest" ? "p.created_at DESC, p.id DESC"
        : sort === "most-read" ? "COALESCE(p.views, 0) DESC, p.created_at DESC, p.id DESC"
        : sort === "most-liked" ? "COALESCE(p.likes, 0) DESC, p.created_at DESC, p.id DESC"
        : "(COALESCE(p.likes, 0) * 3 + COALESCE(p.views, 0) + CASE WHEN p.created_at > NOW() - INTERVAL '7 days' THEN 20 ELSE 0 END) DESC, p.created_at DESC, p.id DESC";
      const where = `p.published_at IS NOT NULL
           AND ($1::text = '' OR COALESCE(p.category, 'General') = $1)
           AND ($2::text = '' OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.tags, ARRAY[]::text[])) t WHERE LOWER(t) = LOWER($2)))
           AND ($3::text = '' OR p.title ILIKE $3 OR p.excerpt ILIKE $3 OR p.content ILIKE $3 OR p.category ILIKE $3)
           AND ($4::int IS NULL OR NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $4 AND b.blocked_id = p.user_id) OR (b.blocker_id = p.user_id AND b.blocked_id = $4)))
           AND (p.user_id = $4 OR NOT EXISTS (SELECT 1 FROM users pu WHERE pu.id = p.user_id AND pu.is_private = TRUE)
             OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $4 AND f.following_id = p.user_id))`;
      const [result, countResult] = await Promise.all([
        pool.query(`${POST_SELECT} WHERE ${where} ORDER BY ${order} LIMIT $5 OFFSET $6`,
          [category, tag, query ? searchPattern : "", userId, limit, offset]),
        pool.query(`SELECT COUNT(*)::int AS total FROM posts p WHERE ${where}`,
          [category, tag, query ? searchPattern : "", userId])
      ]);
      const total = countResult.rows[0]?.total || 0;
      return res.json({ posts: result.rows, page, limit, total, hasMore: offset + result.rows.length < total, sort });
    } catch (error) {
      console.error("Discovery feed error:", error);
      return res.status(500).json({ error: "Unable to load discovery feed" });
    }
  });

  app.get("/api/discovery/categories", async (_req, res) => {
    const cacheKey = "public-discovery-categories-v1";
    const cached = publicAggregateCache.get(cacheKey);
    if (cached) return res.json({ categories: cached, cached: true });
    try {
      const result = await pool.query(
        `SELECT COALESCE(p.category, 'General') AS category
         FROM posts p JOIN users u ON u.id = p.user_id
         WHERE p.published_at IS NOT NULL AND COALESCE(u.is_private, FALSE) = FALSE
         GROUP BY COALESCE(p.category, 'General') ORDER BY category ASC LIMIT 100`
      );
      const categories = result.rows.map((row) => row.category);
      publicAggregateCache.set(cacheKey, categories);
      return res.json({ categories, cached: false });
    } catch (error) {
      console.error("Discovery categories error:", error);
      return res.status(500).json({ error: "Unable to load categories" });
    }
  });

  app.get("/api/discovery/trending-tags", async (_req, res) => {
    const cacheKey = "public-trending-tags-v1";
    const cached = publicAggregateCache.get(cacheKey);
    if (cached) return res.json({ tags: cached, cached: true });
    try {
      const result = await pool.query(
        `SELECT LOWER(BTRIM(tag)) AS tag, COUNT(*)::int AS post_count
         FROM posts p CROSS JOIN LATERAL unnest(COALESCE(p.tags, ARRAY[]::text[])) AS tags(tag)
         JOIN users u ON u.id = p.user_id
         WHERE p.published_at IS NOT NULL AND COALESCE(u.is_private, FALSE) = FALSE
           AND BTRIM(tag) <> '' AND p.created_at > NOW() - INTERVAL '30 days'
         GROUP BY LOWER(BTRIM(tag)) ORDER BY post_count DESC, tag ASC LIMIT 20`
      );
      const tags = result.rows;
      publicAggregateCache.set(cacheKey, tags);
      return res.json({ tags, cached: false });
    } catch (error) {
      console.error("Trending tags error:", error);
      return res.status(500).json({ error: "Unable to load trending tags" });
    }
  });
};
