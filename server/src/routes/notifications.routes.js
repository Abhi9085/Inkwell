// Routes for notifications. Keep route handlers in this feature module.
module.exports = function registerNotificationsRoutes(app, deps) {
  const { pool, authenticateToken } = deps;

  app.get("/api/notifications", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          n.id,
          n.type,
          n.post_id,
          n.comment_id,
          n.is_read,
          n.created_at,
          n.actor_id,
          fr.id AS follow_request_id,
          fr.status AS follow_request_status,
          u.name AS actor_name,
          u.handle AS actor_handle,
          u.avatar AS actor_avatar,
          p.slug AS post_slug
        FROM notifications n
        LEFT JOIN users u ON u.id = n.actor_id
        LEFT JOIN posts p ON p.id = n.post_id
        LEFT JOIN follow_requests fr
          ON fr.id = n.follow_request_id
          AND n.type = 'follow_request'
        WHERE n.recipient_id = $1
          AND (
            n.actor_id IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM blocks b
              WHERE
                (b.blocker_id = n.actor_id AND b.blocked_id = n.recipient_id)
                OR
                (b.blocker_id = n.recipient_id AND b.blocked_id = n.actor_id)
            )
          )
        ORDER BY n.created_at DESC
        LIMIT 50
        `,
        [req.user.id]
      );
  
      const unreadResult = await pool.query(
        `  
        SELECT COUNT(*)::int AS unread_count
        FROM notifications n
        WHERE n.recipient_id = $1
          AND n.is_read = FALSE
          AND (
            n.actor_id IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM blocks b
              WHERE
                (b.blocker_id = n.actor_id AND b.blocked_id = n.recipient_id)
                OR
                (b.blocker_id = n.recipient_id AND b.blocked_id = n.actor_id)
            )
          )
        `,
        [req.user.id]
      );
  
      res.json({
        notifications: result.rows,
        unreadCount: unreadResult.rows[0].unread_count,
      });
    } catch (error) {
      console.error("Fetch notifications error:", error);
      res.status(500).json({
        error: "Failed to fetch notifications",
      });
    }
  });

  app.patch("/api/notifications/:id/read", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        `
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = $1
          AND recipient_id = $2
        RETURNING id, is_read
        `,
        [req.params.id, req.user.id]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Notification not found",
        });
      }
  
      res.json({
        message: "Notification marked as read",
        notification: result.rows[0],
      });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({
        error: "Failed to mark notification as read",
      });
    }
  });

  app.patch("/api/notifications/read-all", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        `
        UPDATE notifications
        SET is_read = TRUE
        WHERE recipient_id = $1
          AND is_read = FALSE
        RETURNING id
        `,
        [req.user.id]
      );
  
      res.json({
        message: "All notifications marked as read",
        updatedCount: result.rowCount,
      });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({
        error: "Failed to mark all notifications as read",
      });
    }
  });
};
