// Shared server-side visibility checks for profiles and their published posts.
async function canViewProfile(pool, viewerId, profileId) {
  const ownerId = Number(profileId);
  const viewer = viewerId == null ? null : Number(viewerId);

  if (!Number.isInteger(ownerId) || ownerId <= 0) return false;
  if (viewer && viewer === ownerId) return true;

  const profileResult = await pool.query(
    "SELECT is_private FROM users WHERE id = $1",
    [ownerId]
  );
  if (profileResult.rows.length === 0) return false;

  if (viewer && Number.isInteger(viewer) && viewer > 0) {
    const blockedResult = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
       ) AS blocked`,
      [viewer, ownerId]
    );
    if (blockedResult.rows[0]?.blocked) return false;
  }

  if (!profileResult.rows[0].is_private) return true;
  if (!viewer || !Number.isInteger(viewer) || viewer <= 0) return false;

  const followResult = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM follows
       WHERE follower_id = $1 AND following_id = $2
     ) AS following`,
    [viewer, ownerId]
  );
  return Boolean(followResult.rows[0]?.following);
}

async function canViewPost(pool, viewerId, postId) {
  const postResult = await pool.query(
    `SELECT id, user_id FROM posts
     WHERE id = $1 AND published_at IS NOT NULL`,
    [postId]
  );
  if (postResult.rows.length === 0) return false;
  return canViewProfile(pool, viewerId, postResult.rows[0].user_id);
}

module.exports = { canViewProfile, canViewPost };
