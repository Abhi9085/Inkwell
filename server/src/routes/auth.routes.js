// Routes for auth. Keep route handlers in this feature module.
module.exports = function registerAuthRoutes(app, deps) {
  const {
    pool,
    bcrypt,
    jwt,
    googleClient,
    crypto,
    slugify,
    authenticateToken,
    upload,
    uploadBufferToCloudinary,
    deleteFromCloudinary,
    mailer,
  } = deps;

  app.post("/api/auth/register", async (req, res) => {
    const { name, handle, email, password } = req.body;

    if (!name || !handle || !email || !password) {
      return res.status(400).json({
        error: "Name, handle, email and password are required",
      });
    }

    try {
      const existingUser = await pool.query(
        `SELECT id FROM users WHERE email = $1 OR handle = $2`,

        [email, handle]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          error: "Email or handle already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await pool.query(
        `
        INSERT INTO users
          (name, handle, email, password_hash, has_password)
        VALUES
          ($1, $2, $3, $4, TRUE)
        RETURNING
          id,
          name,
          handle,
          email,
          avatar,
          bio,
          role
        `,
        [name, handle, email, hashedPassword]
      );

      res.status(201).json({
        message: "Registration successful",
        user: newUser.rows[0],
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({
        error: "Failed to register user",
      });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    try {
      const result = await pool.query(
        `
        SELECT
          id,
          name,
          handle,
          email,
          password_hash,
          avatar,
          bio,
          role
        FROM users
        WHERE email = $1
        `,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: "Invalid email or password",
        });
      }

      const user = result.rows[0];

      const validPassword = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!validPassword) {
        return res.status(401).json({
          error: "Invalid email or password",
        });
      }

      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          handle: user.handle,
          email: user.email,
          avatar: user.avatar || null,
          bio: user.bio || "",
          role: user.role || "Writer",
        },
      });
    } catch (error) {
      console.error("Login error:", error);

      res.status(500).json({
        error: "Failed to login",
      });
    }
  });

  app.post("/api/auth/google", async (req, res) => {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({
        error: "Google credential is required",
      });
    }

    try {
      // Verify Google's credential on the backend.
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload || !payload.email || payload.email_verified !== true) {
        return res.status(401).json({
          error: "Google account email is not verified",
        });
      }

      const email = payload.email.trim().toLowerCase();

      const name = payload.name?.trim() || email.split("@")[0];

      const avatar = payload.picture || null;

      // Reuse an existing account with this verified email.
      let result = await pool.query(
        `
        SELECT id, name, handle, email, avatar, bio, role
        FROM users
        WHERE LOWER(email) = $1
        LIMIT 1
        `,
        [email]
      );

      let user;
      if (result.rows.length > 0) {
        user = result.rows[0];
      } else {
        // Generate a unique handle for a new Google user.
        const baseHandle =
          slugify(name) || slugify(email.split("@")[0]) || "writer";

        let handle = baseHandle;
        let suffix = 1;
        while (true) {
          const existingHandle = await pool.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(handle) = LOWER($1)
            LIMIT 1
            `,
            [handle]
          );

          if (existingHandle.rows.length === 0) {
            break;
          }

          handle = `${baseHandle}-${suffix++}`;
        }

        // Generate an unusable random password so the existing

        // password_hash requirement remains compatible.
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const passwordHash = await bcrypt.hash(randomPassword, 10);
        result = await pool.query(
          `
          INSERT INTO users (
            name,
            handle,
            email,
            password_hash,
            avatar,
            has_password
          )
  
          VALUES ($1, $2, $3, $4, $5, FALSE)
          RETURNING
            id, name, handle, email, avatar, bio, role
          `,
          [name, handle, email, passwordHash, avatar]
        );

        user = result.rows[0];
      }

      // Issue the same Inkwell JWT used by normal login.
      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          handle: user.handle,
          email: user.email,
          avatar: user.avatar || null,
          bio: user.bio || "",
          role: user.role || "Writer",
        },
      });
    } catch (error) {
      console.error("Google login error:", error);

      return res.status(401).json({
        error: "Google sign-in failed. Please try again.",
      });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const genericMessage =
      "If an account exists for that email, a reset link will be sent.";

    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(200).json({ message: genericMessage });
    }

    try {
      const result = await pool.query(
        `SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [email]
      );

      // Do not reveal whether an account exists.
      if (result.rows.length === 0) {
        return res.json({ message: genericMessage });
      }

      const user = result.rows[0];

      // 32 random bytes; only the hash is stored in the database.
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      await pool.query(
        `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = $1 AND used_at IS NULL
        `,
        [user.id]
      );

      await pool.query(
        `
        INSERT INTO password_reset_tokens
          (user_id, token_hash, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
        `,
        [user.id, tokenHash]
      );

      const resetUrl =
        `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;

      try {
        await mailer.sendMail({
          from: process.env.SMTP_FROM,
          to: user.email,
          subject: "Reset your Inkwell password",
          text: [
            "We received a request to reset your Inkwell password.",
            "",
            `Use this link within 15 minutes: ${resetUrl}`,
            "",
            "If you didn't request this, you can ignore this email.",
          ].join("\n"),
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
              <h2>Reset your Inkwell password</h2>
              <p>We received a request to reset your password.</p>
              <p>
                <a href="${resetUrl}"
                   style="display:inline-block;padding:12px 20px;
                          background:#222;color:#fff;text-decoration:none;
                          border-radius:8px">
                  Reset password
                </a>
              </p>
              <p>This link expires in 15 minutes and can only be used once.</p>
              <p>If you didn't request this, you can ignore this email.</p>
            </div>
          `,
        });
      } catch (mailError) {
        // Keep the response generic so account existence isn't disclosed.
        console.error("Password reset email delivery failed:", mailError);
      }

      return res.json({ message: genericMessage });
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).json({
        error: "Unable to process the request right now.",
      });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body;
  
    if (
      typeof token !== "string" ||
      token.length !== 64 ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        error: "Use a valid reset link and a password between 8 and 128 characters.",
      });
    }
  
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
  
    let client;
  
    try {
      client = await pool.connect();
      await client.query("BEGIN");
    
      const result = await client.query(
        `
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        FOR UPDATE
        `,
        [tokenHash]
      );
    
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "This reset link is invalid or has expired. Request a new one.",
        });
      }
    
      const reset = result.rows[0];
      const passwordHash = await bcrypt.hash(password, 10);
    
      await client.query(
        `
        UPDATE users
        SET password_hash = $1,
            has_password = TRUE
        WHERE id = $2
        `,
        [passwordHash, reset.user_id]
      );
    
      // Mark every outstanding reset token for this user as used.
      await client.query(
        `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = $1 AND used_at IS NULL
        `,
        [reset.user_id]
      );
    
      await client.query("COMMIT");
    
      return res.json({
        message: "Password reset successfully. You can now log in.",
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }
    
      console.error("Reset password error:", error);
      return res.status(500).json({
        error: "Unable to reset your password right now.",
      });
    } finally {
      client?.release();
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.handle,
          u.email,
          u.has_password,
          u.avatar,
          u.cover,
          u.bio,
          u.role,
          u.created_at,
          u.is_private,
          (
            SELECT COUNT(*)::int
            FROM follows f
            WHERE f.following_id = u.id
          ) AS followers_count,
          (
            SELECT COUNT(*)::int
            FROM follows f
            WHERE f.follower_id = u.id
          ) AS following_count
        FROM users u
        WHERE u.id = $1
        `,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const user = result.rows[0];

      res.json({
        id: user.id,
        name: user.name,
        handle: user.handle,
        email: user.email,
        has_password: user.has_password,
        avatar: user.avatar || null,
        cover: user.cover || null,
        bio: user.bio || "",
        role: user.role || "Writer",
        created_at: user.created_at,
        is_private: user.is_private,
        followersCount: user.followers_count || 0,
        followingCount: user.following_count || 0,
      });
    } catch (error) {
      console.error("Get current user error:", error);

      res.status(500).json({
        error: "Failed to fetch current user",
      });
    }
  });

  app.put(
    "/api/auth/profile",
    authenticateToken,
    upload.fields([
      { name: "avatar", maxCount: 1 },
      { name: "cover", maxCount: 1 },
    ]),

    async (req, res) => {
      const { name, handle, bio, is_private } = req.body || {};

      if (!name?.trim() || !handle?.trim()) {
        return res.status(400).json({
          error: "Name and handle are required",
        });
      }

      const cleanName = name.trim();
      const cleanHandle = handle.trim().toLowerCase();
      const cleanBio = bio?.trim() || "";
      const avatarFile = req.files?.avatar?.[0];
      const coverFile = req.files?.cover?.[0];
      try {
        // ------------------------------------------
        // Check duplicate handle
        // ------------------------------------------
        const existingUser = await pool.query(
          `
          SELECT id
          FROM users
          WHERE handle = $1
            AND id <> $2
          `,
          [cleanHandle, req.user.id]
        );

        if (existingUser.rows.length > 0) {
          return res.status(409).json({
            error: "Handle already exists",
          });
        }
        // ------------------------------------------
        // Get existing images
        // ------------------------------------------
        const existingUserResult = await pool.query(
          `
          SELECT
            avatar,
            cover,
            avatar_public_id,
            cover_public_id
          FROM users
          WHERE id = $1
          `,
          [req.user.id]
        );

        if (existingUserResult.rows.length === 0) {
          return res.status(404).json({
            error: "User not found",
          });
        }

        const currentUser = existingUserResult.rows[0];
        let avatarUrl = currentUser.avatar;
        let coverUrl = currentUser.cover;
        let avatarPublicId = currentUser.avatar_public_id;
        let coverPublicId = currentUser.cover_public_id;
        // ------------------------------------------
        // Upload new avatar
        // ------------------------------------------
        if (avatarFile) {
          const uploadedAvatar = await uploadBufferToCloudinary(
            avatarFile.buffer,
            "inkwell/avatars"
          );

          if (!uploadedAvatar?.secure_url) {
            return res.status(400).json({
              error: "Failed to upload avatar",
            });
          }

          avatarUrl = uploadedAvatar.secure_url;
          avatarPublicId = uploadedAvatar.public_id;

          // Delete old avatar
          if (currentUser.avatar_public_id) {
            await deleteFromCloudinary(currentUser.avatar_public_id);
          }
        }

        // ------------------------------------------
        // Upload new cover
        // ------------------------------------------
        if (coverFile) {
          const uploadedCover = await uploadBufferToCloudinary(
            coverFile.buffer,
            "inkwell/covers"
          );

          if (!uploadedCover?.secure_url) {
            return res.status(400).json({
              error: "Failed to upload cover image",
            });
          }

          coverUrl = uploadedCover.secure_url;
          coverPublicId = uploadedCover.public_id;

          // Delete old cover
          if (currentUser.cover_public_id) {
            await deleteFromCloudinary(currentUser.cover_public_id);
          }
        }

        // ------------------------------------------
        // Update database
        // ------------------------------------------
        const result = await pool.query(
          `
          UPDATE users
          SET
            name = $1,
            handle = $2,
            bio = $3,
            avatar = $4,
            cover = $5,
            avatar_public_id = $6,
            cover_public_id = $7,
            is_private = $8
          WHERE id = $9

          RETURNING
            id,
            name,
            handle,
            email,
            avatar,
            cover,
            bio,
            role,
            is_private
          `,
          [
            cleanName,
            cleanHandle,
            cleanBio,
            avatarUrl,
            coverUrl,
            avatarPublicId,
            coverPublicId,
            is_private === "true" || is_private === true,
            req.user.id,
          ]
        );
        const user = result.rows[0];

        // ------------------------------------------
        // Get follow counts
        // ------------------------------------------
        const followersResult = await pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM follows
          WHERE following_id = $1
          `,
          [req.user.id]
        );
        const followingResult = await pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM follows
          WHERE follower_id = $1
          `,
          [req.user.id]
        );

        res.json({
          id: user.id,
          is_private: user.is_private,
          name: user.name,
          handle: user.handle,
          email: user.email,
          avatar: user.avatar || null,
          cover: user.cover || null,
          bio: user.bio || "",
          role: user.role || "Writer",
          followersCount: followersResult.rows[0].count,
          followingCount: followingResult.rows[0].count,
        });
      } catch (error) {
        console.error("Update profile error:", error);

        res.status(500).json({
          error: "Failed to update profile",
        });
      }
    }
  );
};
