// Routes for search. Private-profile posts are returned only to accepted followers.
module.exports = function registerSearchRoutes(app, deps) {
  const { pool, POST_SELECT, optionalAuthenticateToken } = deps;
  const { canViewPost } = require("../utils/privacy.utils");

  app.get("/api/search", optionalAuthenticateToken, async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ posts: [], users: [] });

    try {
      const searchTerm = `%${q}%`;
      const postsResult = await pool.query(
        `${POST_SELECT}
         WHERE p.published_at IS NOT NULL
           AND (
             p.title ILIKE $1 OR p.excerpt ILIKE $1 OR
             p.content ILIKE $1 OR p.category ILIKE $1 OR
             EXISTS (
               SELECT 1
               FROM unnest(COALESCE(p.tags, ARRAY[]::text[])) AS tag
               WHERE tag ILIKE $1
             )
           )
         ORDER BY p.created_at DESC
         LIMIT 20`,
        [searchTerm]
      );

      const usersResult = await pool.query(
        `SELECT u.id, u.name, u.handle, u.avatar, u.bio
         FROM users u
         WHERE u.name ILIKE $1 OR u.handle ILIKE $1
         ORDER BY u.name ASC
         LIMIT 10`,
        [searchTerm]
      );

      const visiblePosts = [];
      for (const post of postsResult.rows) {
        if (await canViewPost(pool, req.user?.id ?? null, post.id)) {
          visiblePosts.push(post);
        }
      }

      return res.json({ posts: visiblePosts, users: usersResult.rows });
    } catch (error) {
      console.error("Search error:", error);
      return res.status(500).json({ error: "Failed to search" });
    }
  });
};
