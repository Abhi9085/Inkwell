// Routes for users. Keep route handlers in this feature module.
const { canViewProfile } = require("../utils/privacy.utils");

module.exports = function registerUsersRoutes(app, deps) {
  const {
    pool,
    authenticateToken,
    POST_SELECT,
    upload,
    uploadBufferToCloudinary,
    deleteFromCloudinary,
    jwt,
    isBlockedBetween,
  } = deps;

  const getOptionalUserId = (req) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) return null;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
      return Number(decoded.id);
    } catch {
      return null;
    }
  };

  app.post("/api/users/:id/block", authenticateToken, async (req, res) => {
    const targetUserId = Number(req.params.id);
    const currentUserId = Number(req.user.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({
        error: "You cannot block yourself",
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      // Verify target user exists.
      const userCheck = await client.query(
        "SELECT id FROM users WHERE id = $1",
        [targetUserId]
      );

      if (userCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      // Create block relationship.
      await client.query(
        `INSERT INTO blocks (blocker_id, blocked_id)
         VALUES ($1, $2)
         ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
        [currentUserId, targetUserId]
      );

      // Cancel pending follow requests in either direction when users block.
      await client.query(
        `UPDATE follow_requests
         SET status = 'rejected'
         WHERE status = 'pending'
           AND ((requester_id = $1 AND recipient_id = $2)
             OR (requester_id = $2 AND recipient_id = $1))`,
        [currentUserId, targetUserId]
      );

      // Remove follows in both directions.
      const removedFollows = await client.query(
        `DELETE FROM follows
         WHERE (follower_id = $1 AND following_id = $2)
            OR (follower_id = $2 AND following_id = $1)
         RETURNING follower_id, following_id`,
        [currentUserId, targetUserId]
      );

      await client.query("COMMIT");

      // Synchronize follow lists after successful commit.
      const io = req.app.get("io");

      // Remove existing real-time subscriptions between blocked users.
      if (io) {
        try {
          // Remove blocked users from each other's profile rooms.
          const profileRooms = [
            { room: `profile:${currentUserId}`, removeUser: targetUserId },
            { room: `profile:${targetUserId}`, removeUser: currentUserId },
          ];
        
          for (const { room, removeUser } of profileRooms) {
            const sockets = await io.in(room).fetchSockets();
          
            for (const socket of sockets) {
              if (Number(socket.data.userId) === removeUser) {
                await socket.leave(room);
              }
            }
          }
        
          // Find posts belonging to both users.
          const postsResult = await pool.query(
            `SELECT id, user_id FROM posts
             WHERE user_id = ANY($1::int[])`,
            [[currentUserId, targetUserId]]
          );
        
          for (const post of postsResult.rows) {
            const postAuthorId = Number(post.user_id);
          
            const blockedViewerId =
              postAuthorId === currentUserId
                ? targetUserId
                : currentUserId;
          
            const room = `post:${post.id}`;
            const sockets = await io.in(room).fetchSockets();
          
            for (const socket of sockets) {
              if (Number(socket.data.userId) === blockedViewerId) {
                await socket.leave(room);
              }
            }
          }
        } catch (socketError) {
          console.error("Socket room cleanup error:", socketError);
        }
      }

      if (io && removedFollows.rows.length > 0) {
        for (const relationship of removedFollows.rows) {
          const followerId = Number(relationship.follower_id);
          const followingId = Number(relationship.following_id);

          const [followerResult, followingResult] = await Promise.all([
            pool.query(
              "SELECT id, name, handle, avatar, bio FROM users WHERE id = $1",
              [followerId]
            ),
            pool.query(
              "SELECT id, name, handle, avatar, bio FROM users WHERE id = $1",
              [followingId]
            ),
          ]);

          const follower = followerResult.rows[0];
          const following = followingResult.rows[0];

          if (follower && following) {
            const countResult = await pool.query(
              "SELECT COUNT(*)::int AS count FROM follows WHERE following_id = $1",
              [followingId]
            );

            const payload = {
              follower,
              following,
              followersCount: countResult.rows[0].count,
            };

            io.to(`user:${followerId}`).emit("follow:deleted", payload);
            io.to(`user:${followingId}`).emit("follow:deleted", payload);
          }
        }
      }

      return res.json({ blocked: true });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Block user error:", error);

      return res.status(500).json({
        error: "Failed to block user",
      });

    } finally {
      client?.release();
    }
  });

  // Unblock a user
  app.delete("/api/users/:id/block", authenticateToken, async (req, res) => {
    const targetUserId = Number(req.params.id);
    const currentUserId = Number(req.user.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    try {
      const result = await pool.query(
        `DELETE FROM blocks
         WHERE blocker_id = $1 AND blocked_id = $2
         RETURNING id`,
        [currentUserId, targetUserId]
      );

      return res.json({
        blocked: false,
        message: result.rowCount > 0
          ? "User unblocked successfully"
          : "User was not blocked",
      });
    } catch (error) {
      console.error("Unblock user error:", error);

      return res.status(500).json({
        error: "Failed to unblock user",
      });
    }
  });

  // Get users blocked by the current user
  app.get("/api/users/blocked", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           u.id,
           u.name,
           u.handle,
           u.avatar,
           u.bio,
           b.created_at AS "blockedAt"
         FROM blocks b
         JOIN users u ON u.id = b.blocked_id
         WHERE b.blocker_id = $1
         ORDER BY b.created_at DESC`,
        [req.user.id]
      );

      return res.json(result.rows);
    } catch (error) {
      console.error("Get blocked users error:", error);

      return res.status(500).json({
        error: "Failed to fetch blocked users",
      });
    }
  });

  app.get("/api/users/:id", async (req, res) => {  
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        error: "Invalid user id",
      });
    }

    const currentUserId = getOptionalUserId(req);

    if (currentUserId && currentUserId !== userId) {
      const blocked = await isBlockedBetween(currentUserId, userId);
    
      if (blocked) {
        return res.status(404).json({
          error: "User not found",
        });
      }
    }

    try {
      const result = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.handle,
          u.avatar,
          u.cover,
          COALESCE(u.bio, '') AS bio,
          COALESCE(u.role, 'Writer') AS role,
          COALESCE(u.is_private, false) AS is_private,
  
          (
            SELECT COUNT(*)::int
            FROM follows f
            WHERE f.following_id = u.id
          ) AS "followersCount",
  
          (
            SELECT COUNT(*)::int
            FROM follows f
            WHERE f.follower_id = u.id
          ) AS "followingCount"
        FROM users u
        WHERE u.id = $1
        `,
        [userId]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "User not found",
        });
      }
  
      res.json(result.rows[0]);

    } catch (error) {
      console.error("Get public user profile error:", error);
  
      res.status(500).json({
        error: "Failed to fetch user profile",
      });
    }
  });

  app.get("/api/users/:id/posts", async (req, res) => {
    const userId = Number(req.params.id);
  
    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        error: "Invalid user id",
      });
    }

    const currentUserId = getOptionalUserId(req);

    try {
      const allowed = await canViewProfile(pool, currentUserId, userId);
      if (!allowed) return res.status(404).json({ error: "User not found" });

      const userCheck = await pool.query(
        `SELECT id FROM users WHERE id = $1`,
        [userId]
      );
  
      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const result = await pool.query(
        `
        ${POST_SELECT}
        WHERE p.user_id = $1
          AND p.published_at IS NOT NULL
        ORDER BY p.created_at DESC
        `,
        [userId]
      );

      res.json(result.rows);  

    } catch (error) {
      console.error("Get user posts error:", error);

      res.status(500).json({
        error: "Failed to fetch user posts",
      });  
    }
  });
};



