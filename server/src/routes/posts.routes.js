const { emitProfileStats } = require("../utils/profile-stats.utils");
const { canViewProfile, canViewPost } = require("../utils/privacy.utils");


function cleanPostExcerpt(text = "") {
  return text
    // Remove Markdown images
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")

    // Remove HTML images
    .replace(/<img\b[^>]*>/gi, " ")

    // Remove fenced code blocks
    .replace(/```[\s\S]*?```/g, " ")

    // Keep link text, remove URL
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")

    // Remove horizontal rules
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, " ")

    // Remove heading, quote and list markers
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")

    // Remove inline Markdown formatting
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/([*_~])([^*_~]+)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")

    // Clean remaining whitespace
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}


// Routes for posts. Keep route handlers in this feature module.
module.exports = function registerPostsRoutes(app, deps) {
  const {
    pool,
    authenticateToken,
    isBlockedBetween,
    uploadSingleImage,
    uploadToCloudinary,
    POST_SELECT,
    slugify,
    generateExcerpt,
    jwt,
    deleteFromCloudinary,
  } = deps;

  const normalizeTags = (rawTags) => {
    let parsedTags = rawTags;

    if (typeof rawTags === "string") {
      try {
        parsedTags = JSON.parse(rawTags);
      } catch {
        return [];
      }
    }

    if (!Array.isArray(parsedTags)) return [];

    return [
      ...new Set(
        parsedTags
          .filter((tag) => typeof tag === "string")
          .map((tag) => tag.trim().replace(/^#+/, "").toLowerCase())
          .filter(Boolean)
      ),
    ].slice(0, 5);
  };


  app.post("/api/posts/:id/view", authenticateToken, async (req, res) => {
    const postId = Number.parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ error: "Invalid post ID" });
    }

    const canView = await canViewPost(pool, userId, postId);
    if (!canView) return res.status(404).json({ error: "Post not found" });

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const event = await client.query(
        `
        INSERT INTO post_view_events (post_id, user_id)
        SELECT id, $2
        FROM posts
        WHERE id = $1
          AND published_at IS NOT NULL
        RETURNING id
        `,
        [postId, userId]
      );

      if (event.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Published post not found" });
      }

      const inserted = await client.query(
        `
        INSERT INTO post_views (post_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (post_id, user_id) DO NOTHING
        RETURNING id
        `,
        [postId, userId]
      );

      let postOwnerId = null;

      if (inserted.rows.length > 0) {
        const viewUpdate = await client.query(
          `
            UPDATE posts
            SET views = COALESCE(views, 0) + 1
            WHERE id = $1
            RETURNING user_id
          `,
          [postId]
        );

        postOwnerId = viewUpdate.rows[0]?.user_id;
      }

      const result = await client.query(
        "SELECT views FROM posts WHERE id = $1",
        [postId]
      );

      await client.query("COMMIT");
          
      return res.json({ views: result.rows[0].views });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("View error:", error);
      return res.status(500).json({ error: "Failed to track view" });
    } finally {
      client?.release();
    }
  });



  app.post(
    "/api/posts/:id/like",
    authenticateToken,
    async (req, res) => {
      const postId = Number.parseInt(req.params.id, 10);
      const userId = req.user.id;
    
      if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).json({ error: "Invalid post ID" });
      }
    
      const canView = await canViewPost(pool, userId, postId);
      if (!canView) return res.status(404).json({ error: "Post not found" });

      const client = await pool.connect();
    
      try {
        await client.query("BEGIN");
      
        // Lock this post so concurrent Like/Unlike operations
        // for this post are processed in order.
        const postResult = await client.query(
          `SELECT id, user_id, likes
           FROM posts
           WHERE id = $1
           FOR UPDATE`,
          [postId]
        );
      
        if (postResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Post not found" });
        }
      
        const post = postResult.rows[0];

        const blocked = await isBlockedBetween(userId, post.user_id);

        if (blocked) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            error: "Post not found",
          });
        }
      
        // Authors cannot like their own posts.
        if (Number(post.user_id) === Number(userId)) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error: "You cannot like your own post.",
          });
        }
      
        // Insert only if this user has not already liked this post.
        const likeResult = await client.query(
          `INSERT INTO post_likes (post_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (post_id, user_id) DO NOTHING
           RETURNING id`,
          [postId, userId]
        );
      
        let likes = Number(post.likes) || 0;
      
        // Increase the counter only when a new Like was inserted.
        if (likeResult.rows.length > 0) {
          const updateResult = await client.query(
            `UPDATE posts
             SET likes = likes + 1
             WHERE id = $1
             RETURNING likes`,
            [postId]
          );
        
          likes = Number(updateResult.rows[0].likes);
        
          // Create a notification only for a newly inserted Like.
          await client.query(
            `INSERT INTO notifications
               (recipient_id, actor_id, type, post_id)
             VALUES ($1, $2, 'like', $3)`,
            [post.user_id, userId, postId]
          );
        }
      
        // Commit before broadcasting to other viewers.
        await client.query("COMMIT");

        if (likeResult.rows.length > 0) {
        // Send real-time notification to the post author.
        req.app.get("io")
          ?.to(`user:${post.user_id}`)
          .emit("notification:new");

          emitProfileStats(
            pool,
            req.app.get("io"),
            post.user_id
          ).catch((error) => {
            console.error("Like stats broadcast failed:", error);
          });
        }
      
        req.app.get("io")
          ?.to(`post:${postId}`)
          .emit("post:likes-updated", {
            postId,
            likes,
          });
        
        return res.json({
          liked: true,
          likes,
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
      
        console.error("LIKE ERROR:", error);
      
        return res.status(500).json({
          error: "Failed to like post",
        });
      } finally {
        client.release();
      }
    }
  );
  
  
  app.delete(
    "/api/posts/:id/like",
    authenticateToken,
    async (req, res) => {
      const postId = Number.parseInt(req.params.id, 10);
      const userId = req.user.id;
    
      if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).json({ error: "Invalid post ID" });
      }
    
      const canView = await canViewPost(pool, userId, postId);
      if (!canView) return res.status(404).json({ error: "Post not found" });

      const client = await pool.connect();
    
      try {
        await client.query("BEGIN");
      
        // Use the same post-row lock as the POST route.
        const postResult = await client.query(
          `SELECT id, user_id, likes
           FROM posts
           WHERE id = $1
           FOR UPDATE`,
          [postId]
        );
      
        if (postResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Post not found" });
        }
      
        const post = postResult.rows[0];
      
        // Delete only this user's Like.
        const deleteResult = await client.query(
          `DELETE FROM post_likes
           WHERE post_id = $1 AND user_id = $2
           RETURNING id`,
          [postId, userId]
        );
      
        let likes = Number(post.likes) || 0;
      
        // Decrease the counter only if a row was actually deleted.
        if (deleteResult.rows.length > 0) {
          const updateResult = await client.query(
            `UPDATE posts
             SET likes = GREATEST(likes - 1, 0)
             WHERE id = $1
             RETURNING likes`,
            [postId]
          );
        
          likes = Number(updateResult.rows[0].likes);
        }
      
        // Commit before broadcasting.
        await client.query("COMMIT");

        if (deleteResult.rows.length > 0) {
          emitProfileStats(
            pool,
            req.app.get("io"),
            post.user_id
          ).catch((error) => {
            console.error("Unlike stats broadcast failed:", error);
          });
        }
      
        req.app.get("io")
          ?.to(`post:${postId}`)
          .emit("post:likes-updated", {
            postId,
            likes,
          });
        
        return res.json({
          liked: false,
          likes,
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
      
        console.error("UNLIKE ERROR:", error);
      
        return res.status(500).json({
          error: "Failed to unlike post",
        });
      } finally {
        client.release();
      }
    }
  );


  app.get("/api/posts/:id/like-status", authenticateToken, async (req, res) => {
    const postId = Number.parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ error: "Invalid post ID" });
    }

    try {
      const canView = await canViewPost(pool, userId, postId);
      if (!canView) return res.status(404).json({ error: "Post not found" });

      const postResult = await pool.query(
        "SELECT user_id FROM posts WHERE id = $1",
        [postId]
      );
      
      if (postResult.rows.length === 0) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      const blocked = await isBlockedBetween(
        userId,
        postResult.rows[0].user_id
      );
      
      if (blocked) {
        return res.status(404).json({ error: "Post not found" });
      }

      const result = await pool.query(
        `
        SELECT
          EXISTS (
            SELECT 1
            FROM post_likes
            WHERE post_id = $1 AND user_id = $2
          ) AS liked,
          (
            SELECT COUNT(*)::int
            FROM post_likes
            WHERE post_id = $1
          ) AS likes
        FROM posts
        WHERE id = $1
        `,
        [postId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Post not found" });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Get like status error:", error);
      return res.status(500).json({ error: "Failed to get like status" });
    }
  });

  // Get liked posts — only the logged-in user can access their own likes.
  app.get(
    "/api/users/:id/liked-posts",
    authenticateToken,
    async (req, res) => {
      const requestedUserId = Number(req.params.id);
      const currentUserId = Number(req.user.id);
    
      if (
        !Number.isInteger(requestedUserId) ||
        requestedUserId <= 0
      ) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
    
      // Prevent users from viewing someone else's liked posts.
      if (requestedUserId !== currentUserId) {
        return res.status(403).json({
          error: "You can only view your own liked posts",
        });
      }
    
      try {
        const result = await pool.query(
          `
          ${POST_SELECT}
          WHERE p.id IN (
            SELECT pl.post_id
            FROM post_likes pl
            WHERE pl.user_id = $1
          )
          AND p.published_at IS NOT NULL
          ORDER BY p.created_at DESC
          `,
          [currentUserId]
        );
      
        const visiblePosts = [];
        for (const post of result.rows) {
          if (await canViewPost(pool, currentUserId, post.id)) {
            visiblePosts.push(post);
          }
        }
        return res.json(visiblePosts);
      } catch (error) {
        console.error("Get liked posts error:", error);
      
        return res.status(500).json({
          error: "Failed to fetch liked posts",
        });
      }
    }
  );

  app.post(
    "/api/posts/inline-image",
    authenticateToken,
    uploadSingleImage,
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "Please select an image." });
        }
      
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
        ];
      
        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            error: "Only JPG, PNG and WebP images are supported.",
          });
        }
      
        const result = await uploadToCloudinary(req.file.buffer);
      
        return res.status(201).json({
          url: result.secure_url,
          publicId: result.public_id,
        });
      } catch (error) {
        console.error("Inline image upload error:", error);
      
        return res.status(500).json({
          error: "Failed to upload inline image.",
        });
      }
    }
  );

  app.post("/api/posts", authenticateToken, uploadSingleImage,
    async (req, res) => {
      const {
        title,
        slug,
        content,
        category,
        tags,
        excerpt,
        reading_time,
        status,
      } = req.body;

      if (!title?.trim() || !content?.trim()) {
        return res.status(400).json({
          error: "Title and content are required",
        });
      }

      try {
        const finalSlug = slug?.trim() ? slugify(slug) : slugify(title);

        const finalTags = normalizeTags(tags);

        const finalExcerpt = cleanPostExcerpt(
          excerpt?.trim() || generateExcerpt(content)
        );

        const parsedReadingTime = Number.parseInt(
          reading_time,

          10
        );

        const readingTime = Number.isNaN(parsedReadingTime)
          ? 1
          : parsedReadingTime;

        let coverUrl = null;
        let coverPublicId = null;

        if (req.file) {
          const result = await uploadToCloudinary(req.file.buffer);

          coverUrl = result.secure_url;
          coverPublicId = result.public_id;
        }

        // ------------------------------------------

        // Draft = NULL

        // Public = current timestamp

        // Scheduled = not supported yet

        // ------------------------------------------

        let publishedAt = null;

        if (status === "Public") {
          publishedAt = new Date();
        }

        const newPost = await pool.query(
          `
          INSERT INTO posts
          (
            user_id,
            title,
            slug,
            content,
            excerpt,
            cover,
            cover_public_id,
            category,
            tags,
            reading_time,
            likes,
            views,
            is_featured,
            is_trending,
            published_at
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            0,
            0,
            false,
            false,
            $11
          )
          RETURNING id
          `,
          [
            req.user.id,
            title.trim(),
            finalSlug,
            content,
            finalExcerpt,
            coverUrl,
            coverPublicId,
            category || "General",
            finalTags,
            readingTime,
            publishedAt,
          ]
        );

        const createdPost = await pool.query(
          `
  
          ${POST_SELECT}
  
          WHERE p.id = $1
  
          `,

          [newPost.rows[0].id]
        );
        await emitProfileStats(
          pool,
          req.app.get("io"),
          req.user.id
        );

        res.status(201).json(createdPost.rows[0]);
      } catch (error) {
        console.error("Create post error:", error);

        if (error.code === "23505") {
          return res.status(400).json({
            error: "A post with this slug already exists",
          });
        }

        res.status(500).json({
          error: "Failed to create post",
        });
      }
    }
  );

  app.get("/api/posts", async (req, res) => {
    try {
      // Identify the current user if a valid token is provided.
      let userId = null;
      const authHeader = req.headers.authorization;

      if (authHeader) {
        const [scheme, token] = authHeader.split(" ");

        if (scheme === "Bearer" && token) {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
            userId = Number(decoded.id);
          } catch {
            userId = null;
          }
        }
      }

      const result = await pool.query(
        `
          ${POST_SELECT}
          WHERE p.published_at IS NOT NULL
            AND (
              $1::int IS NULL
              OR NOT EXISTS (
                SELECT 1 FROM blocks b
                WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id)
                   OR (b.blocker_id = p.user_id AND b.blocked_id = $1)
              )
            )
            AND (
              NOT EXISTS (SELECT 1 FROM users pu WHERE pu.id = p.user_id AND pu.is_private = TRUE)
              OR EXISTS (SELECT 1 FROM follows pf WHERE pf.follower_id = $1 AND pf.following_id = p.user_id)
              OR p.user_id = $1
            )
          ORDER BY p.created_at DESC
        `,
        [userId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Get posts error:", error);

      res.status(500).json({
        error: "Failed to fetch posts",
      });
    }
  });

  app.get(
    "/api/posts/personalized",
    authenticateToken,
    async (req, res) => {
      const userId = req.user.id;

      try {
        // 1. Determine the user's current interests.
        // Last-hour activity has more influence than older activity.
        const interestsResult = await pool.query(
          `
          SELECT
            COALESCE(p.category, 'General') AS category,
            SUM(
              CASE
                WHEN e.viewed_at >= NOW() - INTERVAL '1 hour' THEN 4
                WHEN e.viewed_at >= NOW() - INTERVAL '6 hours' THEN 2
                ELSE 1
              END
            ) AS score
          FROM post_view_events e
          JOIN posts p ON p.id = e.post_id
          WHERE e.user_id = $1
            AND e.viewed_at >= NOW() - INTERVAL '24 hours'
            AND p.published_at IS NOT NULL
          GROUP BY COALESCE(p.category, 'General')
          ORDER BY score DESC
          LIMIT 3
          `,
          [userId]
        );

        const categories = interestsResult.rows.map(
          (row) => row.category
        );

        // 2. Find a fresh article in the user's interest categories.
        let featuredResult;

        if (categories.length > 0) {
          featuredResult = await pool.query(
            `
            SELECT p.id
            FROM posts p
            WHERE p.published_at IS NOT NULL
              AND COALESCE(p.category, 'General') = ANY($1::text[])
              AND NOT EXISTS (
                SELECT 1
                FROM blocks b
                WHERE (b.blocker_id = $2 AND b.blocked_id = p.user_id)
                   OR (b.blocker_id = p.user_id AND b.blocked_id = $2)
              )
              AND NOT EXISTS (
                SELECT 1
                FROM post_view_events e
                WHERE e.post_id = p.id
                  AND e.user_id = $2
                  AND e.viewed_at >= NOW() - INTERVAL '24 hours'
              )
            ORDER BY p.published_at DESC
            LIMIT 1
            `,
            [categories, userId]
          );
        } else {
          featuredResult = { rows: [] };
        }

        // Random fallback if there is no suitable personalized article.
        if (featuredResult.rows.length === 0) {
          featuredResult = await pool.query(
            `
              SELECT p.id
              FROM posts p
              WHERE p.published_at IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1
                  FROM blocks b
                  WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id)
                     OR (b.blocker_id = p.user_id AND b.blocked_id = $1)
                )
              ORDER BY RANDOM()
              LIMIT 1
            `,
            [userId]
          );
        }

        const featuredId = featuredResult.rows[0]?.id ?? null;

        // 3. Find what's trending recently in relevant categories.
        let trendingResult;

        if (categories.length > 0) {
          trendingResult = await pool.query(
            `
              SELECT
                p.id,
                COUNT(e.id)::int AS recent_views,
                MAX(e.viewed_at) AS latest_view
              FROM posts p
              JOIN post_view_events e ON e.post_id = p.id
              WHERE p.published_at IS NOT NULL
                AND COALESCE(p.category, 'General') = ANY($1::text[])
                AND p.id <> COALESCE($2::int, -1)
                AND NOT EXISTS (
                  SELECT 1
                  FROM blocks b
                  WHERE (b.blocker_id = $3 AND b.blocked_id = p.user_id)
                     OR (b.blocker_id = p.user_id AND b.blocked_id = $3)
                )
                AND e.viewed_at >= NOW() - INTERVAL '24 hours'
              GROUP BY p.id
              ORDER BY recent_views DESC, latest_view DESC
              LIMIT 5
            `,
            [categories, featuredId, userId]
          );
        } else {
          trendingResult = { rows: [] };
        }

        // Random fallback if there is not enough recent trend data.
        if (trendingResult.rows.length < 5) {
          const existingIds = [
            featuredId,
            ...trendingResult.rows.map((row) => row.id),
          ].filter((id) => id !== null);

          const fallbackResult = await pool.query(
            `
              SELECT p.id
              FROM posts p
              WHERE p.published_at IS NOT NULL
                AND NOT (p.id = ANY($1::int[]))
                AND NOT EXISTS (
                  SELECT 1
                  FROM blocks b
                  WHERE (b.blocker_id = $3 AND b.blocked_id = p.user_id)
                     OR (b.blocker_id = p.user_id AND b.blocked_id = $3)
                )
              ORDER BY RANDOM()
              LIMIT $2
            `,
            [existingIds, 5 - trendingResult.rows.length, userId]
          );
          trendingResult.rows.push(...fallbackResult.rows);
        }

        // 4. Return full post objects using the existing shared SELECT.
        let featured = null;

        if (featuredId !== null) {
          const result = await pool.query(
            `${POST_SELECT} WHERE p.id = $1`,
            [featuredId]
          );
          featured = result.rows[0] ?? null;
          if (featured && !(await canViewPost(pool, userId, featured.id))) {
            featured = null;
          }
        }

        const trending = [];

        for (const row of trendingResult.rows) {
          const result = await pool.query(
            `${POST_SELECT} WHERE p.id = $1`,
            [row.id]
          );

          if (result.rows[0] && await canViewPost(pool, userId, result.rows[0].id)) {
            trending.push(result.rows[0]);
          }
        }

        return res.json({ featured, trending });
      } catch (error) {
        console.error("Personalized posts error:", error);
        return res.status(500).json({
          error: "Failed to fetch personalized posts",
        });
      }
    }
  );

  app.get(
    "/api/posts/mine",

    authenticateToken,

    async (req, res) => {
      try {
        const result = await pool.query(
          `
  
          ${POST_SELECT}
  
          WHERE p.user_id = $1
  
          ORDER BY p.created_at DESC
  
          `,

          [req.user.id]
        );

        res.json(result.rows);
      } catch (error) {
        console.error("Get my posts error:", error);

        res.status(500).json({
          error: "Failed to fetch your posts",
        });
      }
    }
  );

  app.get("/api/posts/:slug", authenticateToken.optionalAuthenticateToken, async (req, res) => {
    const { slug } = req.params;

    try {
      // ------------------------------------------
      // Get current user if logged in
      // ------------------------------------------
      const userId = req.user?.id ?? null;

      // ------------------------------------------
      // Get post + like status
      // ------------------------------------------

      const result = await pool.query(
        `
        SELECT
          p.id,
          p.title,
          p.slug,
          p.excerpt,
          p.content,
          p.cover,
  
          COALESCE(p.category, 'General') AS category,  
          COALESCE(p.tags, ARRAY[]::text[]) AS tags,
          COALESCE(p.reading_time, 0) AS "readingTime",
          COALESCE(p.likes, 0) AS likes,
          COALESCE(p.views, 0) AS views,
          COALESCE(p.is_featured, false) AS featured,
          COALESCE(p.is_trending, false) AS trending,
  
          CASE
            WHEN p.published_at IS NULL THEN 'Draft'
            ELSE 'Public'
          END AS status,
  
          p.published_at AS "publishedAt",
          p.created_at AS "createdAt",
  
          EXISTS (
            SELECT 1
            FROM post_likes pl
            WHERE pl.post_id = p.id
              AND pl.user_id = $2
          ) AS "likedByMe",
  
          json_build_object(
            'id', u.id,
            'name', u.name,
            'handle', u.handle,
            'avatar', u.avatar,
            'bio', COALESCE(u.bio, ''),
            'role', COALESCE(u.role, 'Writer')
          ) AS author

        FROM posts p  
        JOIN users u ON p.user_id = u.id
    
        WHERE p.slug = $1
          AND (
            p.published_at IS NOT NULL
            OR p.user_id = $2
          )
          AND (
            $2::int IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM blocks b
              WHERE (b.blocker_id = $2 AND b.blocked_id = p.user_id)
                 OR (b.blocker_id = p.user_id AND b.blocked_id = $2)
            )
          )
  
        `,

        [slug, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Post not found" });
      }

      const canView = await canViewPost(pool, userId, result.rows[0].id);
      if (!canView) return res.status(404).json({ error: "Post not found" });

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Get single post error:", error);

      res.status(500).json({
        error: "Failed to fetch post",
      });
    }
  });

  app.put("/api/posts/:id",
    authenticateToken,
    uploadSingleImage,

    async (req, res) => {
      const { id } = req.params;

      const {
        title,
        slug,
        content,
        category,
        tags,
        excerpt,
        reading_time,
        status,
      } = req.body;

      try {
        const postCheck = await pool.query(
          `
          SELECT *
          FROM posts
          WHERE id = $1
          `,
          [id]
        );

        if (postCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Post not found",
          });
        }

        const existingPost = postCheck.rows[0];

        if (String(existingPost.user_id) !== String(req.user.id)) {
          return res.status(403).json({
            error: "You are not authorized to edit this post",
          });
        }

        const finalTitle = title?.trim() || existingPost.title;

        const finalSlug =
          slug !== undefined ? slugify(slug) : existingPost.slug;

        const finalContent = content ?? existingPost.content;

        const finalCategory = category ?? existingPost.category ?? "General";

        const finalTags =
          tags !== undefined
            ? normalizeTags(tags)
            : existingPost.tags ?? [];

        const finalExcerpt = cleanPostExcerpt(
          excerpt?.trim() ||
          generateExcerpt(finalContent) ||
          existingPost.excerpt ||
          ""
        );

        const parsedReadingTime =
          reading_time !== undefined
            ? Number.parseInt(reading_time, 10)
            : existingPost.reading_time;

        const finalReadingTime = Number.isNaN(parsedReadingTime)
          ? existingPost.reading_time
          : parsedReadingTime;

        let finalCover = existingPost.cover;
        let finalCoverPublicId = existingPost.cover_public_id;
        let oldCoverPublicId = null;

        if (req.file) {
          const result = await uploadToCloudinary(req.file.buffer);

          finalCover = result.secure_url;
          finalCoverPublicId = result.public_id;
          oldCoverPublicId = existingPost.cover_public_id;
        }

        // ------------------------------------------
        // Published date
        // ------------------------------------------

        let publishedAt = existingPost.published_at;

        if (status === "Draft") {
          publishedAt = null;
        }

        if (status === "Public") {
          // If already published, keep the original
          // publication date.

          if (!existingPost.published_at) {
            publishedAt = new Date();
          }
        }

        await pool.query(
          `
          UPDATE posts
          SET
            title = $1,
            slug = $2,
            content = $3,
            category = $4,
            tags = $5,
            excerpt = $6,
            reading_time = $7,
            cover = $8,
            cover_public_id = $9,
            published_at = $10
          WHERE id = $11
          `,
          [
            finalTitle,
            finalSlug,
            finalContent,
            finalCategory,
            finalTags,
            finalExcerpt,
            finalReadingTime,
            finalCover,
            finalCoverPublicId,
            publishedAt,
            id,
          ]
        );

        if (oldCoverPublicId && oldCoverPublicId !== finalCoverPublicId) {
          try {
            await deleteFromCloudinary(oldCoverPublicId);
          } catch (error) {
            console.error("Old blog cover cleanup failed:", error);
          }
        }

        const updatedPost = await pool.query(
          `
  
          ${POST_SELECT}
  
          WHERE p.id = $1
  
          `,

          [id]
        );

        res.json(updatedPost.rows[0]);
      } catch (error) {
        console.error("Update post error:", error);

        if (error.code === "23505") {
          return res.status(400).json({
            error: "A post with this slug already exists",
          });
        }

        res.status(500).json({
          error: "Failed to update post",
        });
      }
    }
  );

  app.delete(
    "/api/posts/:id",

    authenticateToken,

    async (req, res) => {
      const { id } = req.params;

      try {
        const postCheck = await pool.query(
          `
  
          SELECT user_id
  
          FROM posts
  
          WHERE id = $1
  
          `,

          [id]
        );

        if (postCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Post not found",
          });
        }

        if (String(postCheck.rows[0].user_id) !== String(req.user.id)) {
          return res.status(403).json({
            error: "You are not authorized to delete this post",
          });
        }

        await pool.query(
          "DELETE FROM posts WHERE id = $1",
          [id]
        );

        await emitProfileStats(
          pool,
          req.app.get("io"),
          req.user.id
        );

        res.json({
          message: "Post deleted successfully",
        });
      } catch (error) {
        console.error("Delete post error:", error);
        res.status(500).json({
          error: "Failed to delete post",
        });
      }
    }
  );
  app.get("/api/posts/edit/:slug", authenticateToken, async (req, res) => {
    const { slug } = req.params;
    const userId = req.user.id;
    try {
      const result = await pool.query(
        `${POST_SELECT}
          WHERE p.slug = $1
            AND p.user_id = $2
          LIMIT 1`,
        [slug, userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Post not found",
        });
      }
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Get post for editing error:", error);
      return res.status(500).json({
        error: "Failed to fetch post for editing",
      });
    }
  });
};
