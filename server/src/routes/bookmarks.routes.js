// Routes for bookmarks. Keep route handlers in this feature module.
module.exports = function registerBookmarksRoutes(app, deps) {
  const { pool, authenticateToken, POST_SELECT } = deps;
  const { canViewPost } = require("../utils/privacy.utils");

  app.get(
  
    "/api/posts/:id/bookmark",
  
    authenticateToken,
  
    async (req, res) => {
  
      const { id } = req.params;
  
  
  
      try {
        const canView = await canViewPost(pool, req.user.id, id);
        if (!canView) return res.status(404).json({ error: "Post not found" });
  
        const result = await pool.query(
  
          `
  
          SELECT id
  
          FROM post_bookmarks
  
          WHERE post_id = $1
  
            AND user_id = $2
  
          `,
  
          [id, req.user.id]
  
        );
  
  
  
        res.json({
  
          saved: result.rows.length > 0,
  
        });
  
      } catch (error) {
  
        console.error("Check bookmark error:", error);
  
  
  
        res.status(500).json({
  
          error: "Failed to check bookmark",
  
        });
  
      }
  
    }
  
  );

  app.post(
  
    "/api/posts/:id/bookmark",
  
    authenticateToken,
  
    async (req, res) => {
  
      const { id } = req.params;
  
  
  
      try {
        const canView = await canViewPost(pool, req.user.id, id);
        if (!canView) return res.status(404).json({ error: "Post not found" });
  
        const postCheck = await pool.query(
  
          `
  
          SELECT id
  
          FROM posts
  
          WHERE id = $1
  
            AND published_at IS NOT NULL
  
          `,
  
          [id]
  
        );
  
  
  
        if (postCheck.rows.length === 0) {
  
          return res.status(404).json({
  
            error: "Post not found",
  
          });
  
        }
  
  
  
        await pool.query(
  
          `
  
          INSERT INTO post_bookmarks (post_id, user_id)
  
          VALUES ($1, $2)
  
          ON CONFLICT (post_id, user_id)
  
          DO NOTHING
  
          `,
  
          [id, req.user.id]
  
        );
  
  
  
        res.json({
  
          saved: true,
  
        });
  
      } catch (error) {
  
        console.error("Add bookmark error:", error);
  
  
  
        res.status(500).json({
  
          error: "Failed to save post",
  
        });
  
      }
  
    }
  
  );

  app.delete(
  
    "/api/posts/:id/bookmark",
  
    authenticateToken,
  
    async (req, res) => {
  
      const { id } = req.params;
  
  
  
      try {
  
        await pool.query(
  
          `
  
          DELETE FROM post_bookmarks
  
          WHERE post_id = $1
  
            AND user_id = $2
  
          `,
  
          [id, req.user.id]
  
        );
  
  
  
        res.json({
  
          saved: false,
  
        });
  
      } catch (error) {
  
        console.error("Remove bookmark error:", error);
  
  
  
        res.status(500).json({
  
          error: "Failed to remove bookmark",
  
        });
  
      }
  
    }
  
  );

  app.get(
  
    "/api/bookmarks/mine",
  
    authenticateToken,
  
    async (req, res) => {
  
      try {
  
        const result = await pool.query(
  
          `
  
          ${POST_SELECT}
  
          JOIN post_bookmarks b
  
            ON b.post_id = p.id
  
          WHERE b.user_id = $1
  
            AND p.published_at IS NOT NULL
  
          ORDER BY b.created_at DESC
  
          `,
  
          [req.user.id]
  
        );
  
  
  
        const visiblePosts = [];
        for (const post of result.rows) {
          if (await canViewPost(pool, req.user.id, post.id)) visiblePosts.push(post);
        }
        res.json(visiblePosts);
  
      } catch (error) {
  
        console.error("Get bookmarks error:", error);
  
  
  
        res.status(500).json({
  
          error: "Failed to fetch saved posts",
  
        });
  
      }
  
    }
  
  );
};
