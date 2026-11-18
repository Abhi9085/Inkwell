// Advanced, privacy-aware search. Existing { posts, users } response keys are retained.
module.exports = function registerSearchRoutes(app, deps) {
  const { pool, POST_SELECT, optionalAuthenticateToken } = deps;

  app.get("/api/search", optionalAuthenticateToken, async (req, res) => {
    const q = String(req.query.q || "").trim().slice(0, 100);
    if (!q) return res.json({ posts: [], users: [], page: 1, limit: 20, total: 0, hasMore: false });
    if (q.length < 2) return res.status(400).json({ error: "Search must contain at least 2 characters" });

    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const sort = ["relevance", "recent", "popular"].includes(String(req.query.sort)) ? String(req.query.sort) : "relevance";
    const category = String(req.query.category || "").trim().slice(0, 60);
    const tag = String(req.query.tag || "").trim().replace(/^#/, "").slice(0, 40);
    const userId = Number.isInteger(Number(req.user?.id)) ? Number(req.user.id) : null;
    const pattern = `%${q}%`;

    const orderBy = sort === "recent" ? "p.created_at DESC, p.id DESC"
      : sort === "popular" ? "COALESCE(p.likes, 0) DESC, p.created_at DESC, p.id DESC"
      : `GREATEST(
          similarity(COALESCE(p.title, ''), $1),
          similarity(COALESCE(p.excerpt, ''), $1),
          similarity(COALESCE(p.category, ''), $1)
        ) DESC, p.created_at DESC, p.id DESC`;

    try {
      const where = `p.published_at IS NOT NULL
        AND (p.title ILIKE $2 OR p.excerpt ILIKE $2 OR p.content ILIKE $2
          OR p.category ILIKE $2
          OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.tags, ARRAY[]::text[])) AS tag_value WHERE tag_value ILIKE $2))
        AND ($3::text = '' OR COALESCE(p.category, 'General') = $3)
        AND ($4::text = '' OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.tags, ARRAY[]::text[])) AS tag_value WHERE LOWER(tag_value) = LOWER($4)))
        AND (NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $5 AND b.blocked_id = p.user_id) OR (b.blocker_id = p.user_id AND b.blocked_id = $5)) OR $5::int IS NULL)
        AND (p.user_id = $5 OR NOT EXISTS (SELECT 1 FROM users pu WHERE pu.id = p.user_id AND pu.is_private = TRUE)
          OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $5 AND f.following_id = p.user_id))`;

      const countWhere = `
        p.published_at IS NOT NULL
        AND (
          p.title ILIKE $1
          OR p.excerpt ILIKE $1
          OR p.content ILIKE $1
          OR p.category ILIKE $1
          OR EXISTS (
            SELECT 1
            FROM unnest(COALESCE(p.tags, ARRAY[]::text[])) AS tag_value
            WHERE tag_value ILIKE $1
          )
        )
        AND ($2::text = '' OR COALESCE(p.category, 'General') = $2)
        AND ($3::text = '' OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p.tags, ARRAY[]::text[])) AS tag_value
          WHERE LOWER(tag_value) = LOWER($3)
        ))
        AND (
          NOT EXISTS (
            SELECT 1 FROM blocks b
            WHERE (b.blocker_id = $4 AND b.blocked_id = p.user_id)
               OR (b.blocker_id = p.user_id AND b.blocked_id = $4)
          )
          OR $4::int IS NULL
        )
        AND (
          p.user_id = $4
          OR NOT EXISTS (
            SELECT 1 FROM users pu
            WHERE pu.id = p.user_id AND pu.is_private = TRUE
          )
          OR EXISTS (
            SELECT 1 FROM follows f
            WHERE f.follower_id = $4 AND f.following_id = p.user_id
          )
        )
      `;

      const [postsResult, countResult, usersResult] = await Promise.all([
        pool.query(`${POST_SELECT} WHERE ${where} ORDER BY ${orderBy} LIMIT $6 OFFSET $7`,
          [q, pattern, category, tag, userId, limit, offset]),
        pool.query(
          `SELECT COUNT(*)::int AS total FROM posts p WHERE ${countWhere}`,
          [pattern, category, tag, userId]
        ),
        pool.query(
          `SELECT u.id, u.name, u.handle, u.avatar, u.bio
           FROM users u
           WHERE (u.name ILIKE $1 OR u.handle ILIKE $1)
             AND ($2::int IS NULL OR u.id = $2 OR NOT EXISTS (
               SELECT 1 FROM blocks b WHERE (b.blocker_id = $2 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $2)
             ))
           ORDER BY CASE WHEN LOWER(u.handle) = LOWER($3) THEN 0 ELSE 1 END, u.name ASC
           LIMIT 10`, [pattern, userId, q])
      ]);

      const total = countResult.rows[0]?.total || 0;
      return res.json({
        posts: postsResult.rows,
        users: usersResult.rows,
        page,
        limit,
        total,
        hasMore: offset + postsResult.rows.length < total,
        sort,
      });
    } catch (error) {
      console.error("Search error:", error);
      return res.status(500).json({ error: "Failed to search" });
    }
  });
};
