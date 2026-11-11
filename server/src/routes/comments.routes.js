// Routes for comments. Keep route handlers in this feature module.
module.exports = function registerCommentsRoutes(app, deps) {
  const { pool, authenticateToken, isBlockedBetween, optionalAuthenticateToken } = deps;
  const { canViewPost } = require("../utils/privacy.utils");

  // Always calculate the count from the database.
  // Replies are included in this count.
  async function getCommentsCount(postId) {
    const result = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM post_comments
      WHERE post_id = $1
        AND parent_comment_id IS NULL
      `,
      [postId]
    );

    return result.rows[0].count;
  }

  // Broadcast the latest total count to everyone viewing this post.
  async function broadcastCommentsCount(postId) {
    const commentsCount = await getCommentsCount(postId);

    app.get("io")
      ?.to(`post:${postId}`)
      .emit("post:comments-updated", {
        postId: Number(postId),
        commentsCount,
      });

    return commentsCount;
  }

  // Fetch a comment with its author details.
  async function getCommentById(commentId) {
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.post_id AS "postId",
        c.parent_comment_id AS "parentCommentId",
        c.content,
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt",
        json_build_object(
          'id', u.id,
          'name', u.name,
          'handle', u.handle,
          'avatar', u.avatar
        ) AS author
      FROM post_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
      `,
      [commentId]
    );

    return result.rows[0];
  }

  async function emitToAllowedPostViewers(
    postId,
    eventName,
    payload,
    actorId
  ) {
    const io = app.get("io");
    if (!io) return;

    try {
      const sockets = await io
        .in(`post:${postId}`)
        .fetchSockets();

      for (const socket of sockets) {
        const viewerId = Number(socket.data.userId);

        // Anonymous visitors can still view public comments.
        if (Number.isInteger(viewerId) && viewerId > 0) {
          try {
            const blocked = await isBlockedBetween(
              viewerId,
              actorId
            );

            if (blocked) continue;
          } catch (error) {
            console.error("Socket block check failed:", error);
            continue;
          }
        }

        socket.emit(eventName, payload);
      }
    } catch (error) {
      console.error("Filtered comment broadcast failed:", error);
    }
  }

  // GET all comments, with replies nested under their parent comments.
  app.get(
    "/api/posts/:id/comments",
    optionalAuthenticateToken,
    async (req, res) => {
    const { id } = req.params;

    try {
      const canView = await canViewPost(pool, req.user?.id ?? null, id);
      if (!canView) return res.status(404).json({ error: "Post not found" });

      if (req.user) {
        const postResult = await pool.query(
          "SELECT user_id FROM posts WHERE id = $1 AND published_at IS NOT NULL",
          [id]
        );
      
        if (postResult.rows.length === 0) {
          return res.status(404).json({ error: "Post not found" });
        }
      
        const blocked = await isBlockedBetween(
          req.user.id,
          postResult.rows[0].user_id
        );
      
        if (blocked) {
          return res.status(404).json({ error: "Post not found" });
        }
      }
      const result = await pool.query(
        `
        SELECT
          c.id,
          c.post_id AS "postId",
          c.parent_comment_id AS "parentCommentId",
          c.content,
          c.created_at AS "createdAt",
          c.updated_at AS "updatedAt",
          json_build_object(
            'id', u.id,
            'name', u.name,
            'handle', u.handle,
            'avatar', u.avatar
          ) AS author
        FROM post_comments c
        JOIN users u ON c.user_id = u.id
        JOIN posts p ON c.post_id = p.id
        WHERE c.post_id = $1
          AND p.published_at IS NOT NULL
        ORDER BY c.created_at DESC
        `,
        [id]
      );

      const visibleRows = req.user
        ? (
            await Promise.all(
              result.rows.map(async (row) => ({
                row,
                blocked: await isBlockedBetween(
                  req.user.id,
                  row.author.id
                ),
              }))
            )
          )
            .filter((item) => !item.blocked)
            .map((item) => item.row)
        : result.rows;      

      const commentsById = new Map();

      // Prepare every comment and give it a replies array.
      for (const row of visibleRows) {
        commentsById.set(row.id, {
          ...row,
          replies: [],
        });
      }

      const comments = [];

      // Attach replies to their parents.
      for (const comment of commentsById.values()) {
        if (comment.parentCommentId) {
          const parent = commentsById.get(comment.parentCommentId);

          if (parent) {
            parent.replies.push(comment);
          }
        } else {
          comments.push(comment);
        }
      }

      res.json(comments);
    } catch (error) {
      console.error("Get comments error:", error);
      res.status(500).json({
        error: "Failed to fetch comments",
      });
    }
  });

  // CREATE a top-level comment or a reply.
  app.post(
    "/api/posts/:id/comments",
    authenticateToken,
    async (req, res) => {
      const { id } = req.params;
      const { content, parentCommentId = null } = req.body;

      if (!content?.trim()) {
        return res.status(400).json({
          error: "Comment cannot be empty",
        });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const canView = await canViewPost(pool, req.user.id, id);
        if (!canView) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Post not found" });
        }

        const postCheck = await client.query(
          `
          SELECT id, user_id
          FROM posts
          WHERE id = $1
            AND published_at IS NOT NULL
          `,
          [id]
        );

        if (postCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            error: "Post not found",
          });
        }

        const postAuthorId = postCheck.rows[0].user_id;

        const blocked = await isBlockedBetween(
          req.user.id,
          postAuthorId
        );
        
        if (blocked) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            error: "Post not found",
          });
        }

        // If this is a reply, make sure the parent exists,
        // belongs to this post, and is not itself a reply.
        if (parentCommentId !== null) {
          const parentCheck = await client.query(
            `
            SELECT id
            FROM post_comments
            WHERE id = $1
              AND post_id = $2
              AND parent_comment_id IS NULL
            `,
            [parentCommentId, id]
          );

          if (parentCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
              error: "You can only reply to a top-level comment",
            });
          }
        }

        const insertResult = await client.query(
          `
          INSERT INTO post_comments (
            post_id,
            user_id,
            content,
            parent_comment_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id
          `,
          [
            id,
            req.user.id,
            content.trim(),
            parentCommentId,
          ]
        );

        const commentId = insertResult.rows[0].id;

        // Preserve your existing post-author notification behavior.
        if (
          postAuthorId != null &&
          Number(postAuthorId) !== Number(req.user.id)
        ) {
          await client.query(
            `
            INSERT INTO notifications (
              recipient_id,
              actor_id,
              type,
              post_id,
              comment_id
            )
            VALUES ($1, $2, 'comment', $3, $4)
            `,
            [postAuthorId, req.user.id, id, commentId]
          );
        }

        await client.query("COMMIT");

        // Notify the post author in real time.
        if (
          postAuthorId != null &&
          Number(postAuthorId) !== Number(req.user.id)
        ) {
          req.app.get("io")
            ?.to(`user:${postAuthorId}`)
            .emit("notification:new");
        }

        const comment = await getCommentById(commentId);
        const commentsCount = await broadcastCommentsCount(id);

        await emitToAllowedPostViewers(
          id,
          "post:comment-created",
          {
            postId: Number(id),
            comment,
            commentsCount,
          },
          req.user.id
        );

        res.status(201).json(comment);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Create comment error:", error);
        res.status(500).json({
          error: "Failed to create comment",
        });
      } finally {
        client.release();
      }
    }
  );

  // EDIT a comment or reply.
  app.patch(
    "/api/posts/comments/:commentId",
    authenticateToken,
    async (req, res) => {
      const { commentId } = req.params;
      const { content } = req.body;

      if (!content?.trim()) {
        return res.status(400).json({
          error: "Comment cannot be empty",
        });
      }

      try {
        const commentCheck = await pool.query(
          `
          SELECT p.user_id AS "postAuthorId"
          FROM post_comments c
          JOIN posts p ON p.id = c.post_id
          WHERE c.id = $1
            AND c.user_id = $2
          `,
          [commentId, req.user.id]
        );
        
        if (commentCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Comment not found or unauthorized",
          });
        }
        
        const blocked = await isBlockedBetween(
          req.user.id,
          commentCheck.rows[0].postAuthorId
        );
        
        if (blocked) {
          return res.status(404).json({
            error: "Comment not found or unauthorized",
          });
        }
        const result = await pool.query(
          `
          UPDATE post_comments
          SET
            content = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
            AND user_id = $3
          RETURNING id
          `,
          [content.trim(), commentId, req.user.id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            error: "Comment not found or unauthorized",
          });
        }

        const comment = await getCommentById(commentId);

        await emitToAllowedPostViewers(
          comment.postId,
          "post:comment-updated",
          {
            postId: comment.postId,
            comment,
          },
          req.user.id
        );

        res.json(comment);
      } catch (error) {
        console.error("Update comment error:", error);
        res.status(500).json({
          error: "Failed to update comment",
        });
      }
    }
  );

  // DELETE a comment or reply.
  app.delete(
    "/api/posts/comments/:commentId",
    authenticateToken,
    async (req, res) => {
      const { commentId } = req.params;

      try {
        const result = await pool.query(
          `
          DELETE FROM post_comments
          WHERE id = $1
            AND user_id = $2
          RETURNING
            id,
            post_id AS "postId",
            parent_comment_id AS "parentCommentId"
          `,
          [commentId, req.user.id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            error: "Comment not found or unauthorized",
          });
        }

        const deletedComment = result.rows[0];
        const commentsCount = await broadcastCommentsCount(
          deletedComment.postId
        );

        await emitToAllowedPostViewers(
          deletedComment.postId,
          "post:comment-deleted",
          {
            postId: deletedComment.postId,
            commentId: deletedComment.id,
            parentCommentId: deletedComment.parentCommentId,
            commentsCount,
          },
          req.user.id
        );

        res.json({
          message: "Comment deleted successfully",
          commentsCount,
        });
      } catch (error) {
        console.error("Delete comment error:", error);
        res.status(500).json({
          error: "Failed to delete comment",
        });
      }
    }
  );
};