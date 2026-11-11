// Follow relationships and realtime follow-list synchronization.
const {
  emitProfileStats,
} = require("../utils/profile-stats.utils");
const { canViewProfile } = require("../utils/privacy.utils");

module.exports = function registerFollowsRoutes(app, deps) {
  const { pool, authenticateToken, blockGuard, isBlockedBetween } = deps;

  const updateProfileStats = async (req, userIds) => {
    const io = req.app.get("io");

    if (!io) return;

    const uniqueIds = [...new Set(userIds.map(Number))];

    const results = await Promise.allSettled(
      uniqueIds.map((id) =>
        emitProfileStats(pool, io, id)
      )
    );

    results.forEach((result) => {
      if (result.status === "rejected") {
        console.error(
          "Profile stats broadcast failed:",
          result.reason
        );
      }
    });
  };

  const getUserSummary = async (userId) => {
    const result = await pool.query(
      `
      SELECT id, name, handle, avatar, bio
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    return result.rows[0] || null;
  };

  const getFollowersCount = async (userId) => {
    const result = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM follows
      WHERE following_id = $1
      `,
      [userId]
    );

    return result.rows[0].count;
  };

  const emitFollowChange = (req, eventName, payload) => {
    const io = req.app.get("io");
    if (!io) return;

    const followerId = Number(payload.follower.id);
    const followingId = Number(payload.following.id);

    // Each user may be connected from multiple tabs/devices.
    io.to(`user:${followerId}`).emit(eventName, payload);
    io.to(`user:${followingId}`).emit(eventName, payload);
  };

  app.get("/api/users/:id/follow", authenticateToken, async (req, res) => {
    const targetUserId = Number(req.params.id);
    const currentUserId = Number(req.user.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
      if (await isBlockedBetween(currentUserId, targetUserId)) {
        return res.status(404).json({ error: "User not found" });
      }

      const userCheck = await pool.query(
        "SELECT id, is_private FROM users WHERE id = $1",
        [targetUserId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const followCheck = await pool.query(
        `
        SELECT 1
        FROM follows
        WHERE follower_id = $1 AND following_id = $2
        `,
        [currentUserId, targetUserId]
      );

      const requestCheck = await pool.query(
        `
        SELECT 1
        FROM follow_requests
        WHERE requester_id = $1
          AND recipient_id = $2
          AND status = 'pending'
        `,
        [currentUserId, targetUserId]
      );

      const followersCount = await getFollowersCount(targetUserId);

      return res.json({
        following: followCheck.rows.length > 0,
        requestPending: requestCheck.rows.length > 0,
        isPrivate: userCheck.rows[0].is_private,
        followersCount,
      });
    } catch (error) {
      console.error("Get follow status error:", error);
      return res.status(500).json({ error: "Failed to get follow status" });
    }
  });


  app.post(
    "/api/users/:id/follow",
    authenticateToken,
    blockGuard(
      (req) => [req.user.id, req.params.id],
      {
        statusCode: 403,
        message: "You cannot follow this user.",
      }
    ),
    async (req, res) => {
      const targetUserId = Number(req.params.id);
      const currentUserId = Number(req.user.id);

      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      if (targetUserId === currentUserId) {
        return res.status(400).json({ error: "You cannot follow yourself" });
      }

      try {
        const userCheck = await pool.query(
          "SELECT id, is_private FROM users WHERE id = $1",
          [targetUserId]
        );

        if (userCheck.rows.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        const isPrivate = userCheck.rows[0].is_private;

        // Check whether the user already follows this profile.
        const existingFollow = await pool.query(
          `SELECT id FROM follows
           WHERE follower_id = $1 AND following_id = $2`,
          [currentUserId, targetUserId]
        );

        const followersCount = await getFollowersCount(targetUserId);

        if (existingFollow.rows.length > 0) {
          return res.json({
            following: true,
            requestPending: false,
            followersCount,
          });
        }

        // Private profile: create a follow request.
        if (isPrivate) {
          const requestResult = await pool.query(
            `
            INSERT INTO follow_requests (requester_id, recipient_id)
            VALUES ($1, $2)
            ON CONFLICT (requester_id, recipient_id)
            WHERE status = 'pending'
            DO NOTHING
            RETURNING id, requester_id
            `,
            [currentUserId, targetUserId]
          );

          // Notify if this request is new or an existing pending request
          // does not have a linked notification.
          let requestId = requestResult.rows[0]?.id;

          if (!requestId) {
            const pendingRequest = await pool.query(
              `
              SELECT id
              FROM follow_requests
              WHERE requester_id = $1
                AND recipient_id = $2
                AND status = 'pending'
              `,
              [currentUserId, targetUserId]
            );
          
            requestId = pendingRequest.rows[0]?.id;
          }

          if (requestId) {
            const notificationResult = await pool.query(
              `
              INSERT INTO notifications (
                recipient_id,
                actor_id,
                type,
                follow_request_id
              )
              SELECT $1, $2, 'follow_request', $3
              WHERE NOT EXISTS (
                SELECT 1
                FROM notifications
                WHERE recipient_id = $1
                  AND actor_id = $2
                  AND type = 'follow_request'
                  AND follow_request_id = $3
              )
              RETURNING id
              `,
              [targetUserId, currentUserId, requestId]
            );
          
            if (notificationResult.rows.length > 0) {
              req.app.get("io")
                ?.to(`user:${targetUserId}`)
                .emit("notification:new");
            }
          }

          return res.json({
            following: false,
            requestPending: true,
            followersCount,
          });
        }

        // Public profile: follow immediately.
        const followResult = await pool.query(
          `
          INSERT INTO follows (follower_id, following_id)
          VALUES ($1, $2)
          ON CONFLICT (follower_id, following_id) DO NOTHING
          RETURNING id
          `,
          [currentUserId, targetUserId]
        );

        if (followResult.rows.length > 0) {
          await pool.query(
            `
            INSERT INTO notifications (recipient_id, actor_id, type)
            VALUES ($1, $2, 'follow')
            `,
            [targetUserId, currentUserId]
          );

          req.app.get("io")
            ?.to(`user:${targetUserId}`)
            .emit("notification:new");

          const [follower, following] = await Promise.all([
            getUserSummary(currentUserId),
            getUserSummary(targetUserId),
          ]);

          const updatedFollowersCount = await getFollowersCount(targetUserId);

          if (follower && following) {
            emitFollowChange(req, "follow:created", {
              follower,
              following,
              followersCount: updatedFollowersCount,
            });
          }

          await updateProfileStats(req, [
            currentUserId,
            targetUserId,
          ]);

          return res.json({
            following: true,
            requestPending: false,
            followersCount: updatedFollowersCount,
          });
        }

        return res.json({
          following: true,
          requestPending: false,
          followersCount: await getFollowersCount(targetUserId),
        });

      } catch (error) {
        console.error("Follow author error:", error);
        return res.status(500).json({
          error: "Failed to follow author",
        });
      }
    }
  );


  app.delete("/api/users/:id/follow", authenticateToken, async (req, res) => {
    const targetUserId = Number(req.params.id);
    const currentUserId = Number(req.user.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
      const deleteResult = await pool.query(
        `
        DELETE FROM follows
        WHERE follower_id = $1 AND following_id = $2
        RETURNING id
        `,
        [currentUserId, targetUserId]
      );

      const followersCount = await getFollowersCount(targetUserId);

      if (deleteResult.rows.length > 0) {
        const [follower, following] = await Promise.all([
          getUserSummary(currentUserId),
          getUserSummary(targetUserId),
        ]);

        if (follower && following) {
          emitFollowChange(req, "follow:deleted", {
            follower,
            following,
            followersCount,
          });
        }
        // Update both users' profile cards.
        await updateProfileStats(req, [
          currentUserId,
          targetUserId,
        ]);
      }

      return res.json({ following: false, followersCount });
    } catch (error) {
      console.error("Unfollow author error:", error);
      return res.status(500).json({ error: "Failed to unfollow author" });
    }
  });

  app.get("/api/users/:id/followers", authenticateToken, async (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
      const allowed = await canViewProfile(pool, req.user.id, userId);
      if (!allowed) return res.status(404).json({ error: "User not found" });

      const result = await pool.query(
        `
        SELECT u.id, u.name, u.handle, u.avatar, u.bio
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
        `,
        [userId]
      );

      return res.json(result.rows);
    } catch (error) {
      console.error("Get followers error:", error);
      return res.status(500).json({ error: "Failed to fetch followers" });
    }
  });

  app.get("/api/users/:id/following", authenticateToken, async (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
      const allowed = await canViewProfile(pool, req.user.id, userId);
      if (!allowed) return res.status(404).json({ error: "User not found" });

      const result = await pool.query(
        `
        SELECT u.id, u.name, u.handle, u.avatar, u.bio
        FROM follows f
        JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
        `,
        [userId]
      );

      return res.json(result.rows);
    } catch (error) {
      console.error("Get following error:", error);
      return res.status(500).json({ error: "Failed to fetch following" });
    }
  });

  // Get pending follow requests.
  app.get(
    "/api/follow-requests",
    authenticateToken,
    async (req, res) => {
      const currentUserId = Number(req.user.id);

      try {
        const result = await pool.query(
          `
          SELECT
            fr.id,
            fr.requester_id,
            fr.created_at,
            u.name,
            u.handle,
            u.avatar,
            u.bio
          FROM follow_requests fr
          JOIN users u ON u.id = fr.requester_id
          WHERE fr.recipient_id = $1
            AND fr.status = 'pending'
          ORDER BY fr.created_at DESC
          `,
          [currentUserId]
        );

        return res.json(result.rows);
      } catch (error) {
        console.error("Get follow requests error:", error);
        return res.status(500).json({
          error: "Failed to fetch follow requests",
        });
      }
    }
  );

  // Accept a follow request.
  app.post(
    "/api/follow-requests/:id/accept",
    authenticateToken,
    async (req, res) => {
      const requestId = Number(req.params.id);
      const currentUserId = Number(req.user.id);

      if (!Number.isInteger(requestId) || requestId <= 0) {
        return res.status(400).json({ error: "Invalid request ID" });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const requestResult = await client.query(
          `
          SELECT id, requester_id, recipient_id
          FROM follow_requests
          WHERE id = $1
            AND recipient_id = $2
            AND status = 'pending'
          FOR UPDATE
          `,
          [requestId, currentUserId]
        );

        if (requestResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            error: "Follow request not found",
          });
        }

        const request = requestResult.rows[0];

        await client.query(
          `
          INSERT INTO follows (follower_id, following_id)
          VALUES ($1, $2)
          ON CONFLICT (follower_id, following_id) DO NOTHING
          `,
          [request.requester_id, currentUserId]
        );

        await client.query(
          `
          UPDATE follow_requests
          SET status = 'accepted'
          WHERE id = $1
          `,
          [requestId]
        );

        await client.query("COMMIT");

        req.app.get("io").to(
          `user:${request.requester_id}`
        ).emit("follow-request:updated", {
          requestId,
          status: "accepted",
          following: true,
        });

        const followersCount = await getFollowersCount(currentUserId);

        const [follower, following] = await Promise.all([
          getUserSummary(request.requester_id),
          getUserSummary(currentUserId),
        ]);

        if (follower && following) {
          emitFollowChange(req, "follow:created", {
            follower,
            following,
            followersCount,
          });
        }

        await updateProfileStats(req, [
          request.requester_id,
          currentUserId,
        ]);

        return res.json({
          success: true,
          following: true,
          followersCount,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("Accept follow request error:", error);
        return res.status(500).json({
          error: "Failed to accept follow request",
        });
      } finally {
        client.release();
      }
    }
  );

  // Reject a follow request.
  app.post(
    "/api/follow-requests/:id/reject",
    authenticateToken,
    async (req, res) => {
      const requestId = Number(req.params.id);
      const currentUserId = Number(req.user.id);

      if (!Number.isInteger(requestId) || requestId <= 0) {
        return res.status(400).json({ error: "Invalid request ID" });
      }

      try {
        const result = await pool.query(
          `
          UPDATE follow_requests
          SET status = 'rejected'
          WHERE id = $1
            AND recipient_id = $2
            AND status = 'pending'
          RETURNING id, requester_id
          `,
          [requestId, currentUserId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            error: "Follow request not found",
          });
        }

        req.app.get("io").to(
          `user:${result.rows[0].requester_id}`
        ).emit("follow-request:updated", {
          requestId,
          status: "rejected",
          following: false,
        });

        return res.json({ success: true });
      } catch (error) {
        console.error("Reject follow request error:", error);
        return res.status(500).json({
          error: "Failed to reject follow request",
        });
      }
    }
  );
};
