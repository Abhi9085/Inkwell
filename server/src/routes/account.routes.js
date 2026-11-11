
module.exports = function registerAccountRoutes(app, deps) {
  const { pool, authenticateToken, deleteFromCloudinary, bcrypt, googleClient } = deps;

  app.delete("/api/account", authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    const { password, googleCredential, confirmation } = req.body || {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ error: "Invalid authenticated user" });
    }

    // Require an explicit confirmation phrase.
    if (confirmation !== "DELETE") {
      return res.status(400).json({
        error: 'Please confirm deletion by sending confirmation: "DELETE"',
      });
    }

    try {
      // Read the account's actual sign-in method from the database.
      const accountResult = await pool.query(
        `SELECT email, password_hash, has_password
         FROM users
         WHERE id = $1`,
        [userId]
      );

      if (accountResult.rowCount === 0) {
        return res.status(404).json({ error: "Account not found" });
      }

      const account = accountResult.rows[0];

      if (account.has_password) {
        // Email/password account: verify the current password.
        if (typeof password !== "string" || !password) {
          return res.status(400).json({
            error: "Your current password is required",
          });
        }

        const validPassword = await bcrypt.compare(
          password,
          account.password_hash
        );

        if (!validPassword) {
          return res.status(401).json({ error: "Incorrect password" });
        }
      } else {
        // Google-only account: verify a Google ID token on the server.
        if (typeof googleCredential !== "string" || !googleCredential) {
          return res.status(400).json({
            error: "Google re-authentication is required",
          });
        }

        let payload;

        try {
          const ticket = await googleClient.verifyIdToken({
            idToken: googleCredential,
            audience: process.env.GOOGLE_CLIENT_ID,
          });

          payload = ticket.getPayload();
        } catch {
          return res.status(401).json({
            error: "Google verification failed. Please sign in again.",
          });
        }

        if (
          !payload ||
          payload.email_verified !== true ||
          !payload.email ||
          payload.email.trim().toLowerCase() !==
            account.email.trim().toLowerCase()
        ) {
          return res.status(401).json({
            error: "Google account verification did not match",
          });
        }
      }

      // Delete the database account and related records atomically.
      const client = await pool.connect();
      let deletedProfile;

      try {

      await client.query("BEGIN");

      // Collect the user's blog cover image IDs before posts are cascade-deleted.
      const postsResult = await client.query(
        `SELECT cover_public_id
         FROM posts
         WHERE user_id = $1
           AND cover_public_id IS NOT NULL`,
        [userId]
      );

      const result = await client.query(
        `DELETE FROM users
         WHERE id = $1
         RETURNING avatar_public_id, cover_public_id`,
        [userId]
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Account not found" });
      }

      deletedProfile = {
        ...result.rows[0],
        postCoverPublicIds: postsResult.rows.map(
          (row) => row.cover_public_id
        ),
      };

      await client.query("COMMIT");

      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }

      // Clean up profile images after the database commit.
      let cleanupPending = false;

      for (const publicId of [
        deletedProfile.avatar_public_id,
        deletedProfile.cover_public_id,
        ...deletedProfile.postCoverPublicIds,
      ]) {
        if (!publicId) continue;

        try {
          const result = await deleteFromCloudinary(publicId);

          if (
            result?.result &&
            result.result !== "ok" &&
            result.result !== "not found"
          ) {
            cleanupPending = true;
            console.error("Cloudinary cleanup needs review:", publicId, result);
          }
        } catch (error) {
          cleanupPending = true;
          console.error("Cloudinary cleanup needs retry:", publicId, error);
        }
      }

      return res.status(200).json({
        message: "Account deleted successfully",
        cleanupPending,
      });
    } catch (error) {
      console.error("Account deletion error:", error);

      return res.status(500).json({
        error: "Could not delete account",
      });
    }
  });
};
