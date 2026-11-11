/**
 * Fetch and broadcast the latest profile statistics.
 *
 * Events:
 *   profile:stats-updated
 *
 * Statistics:
 *   posts, followers, following, views, likes
 */
async function emitProfileStats(pool, io, userId) {
  if (!pool || !io || !userId) return null;

  const id = Number(userId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid profile user ID");
  }

  const result = await pool.query(
    `
    SELECT
      (
        SELECT COUNT(*)::int
        FROM posts
        WHERE user_id = $1
      ) AS posts,

      (
        SELECT COUNT(*)::int
        FROM follows
        WHERE following_id = $1
      ) AS followers,

      (
        SELECT COUNT(*)::int
        FROM follows
        WHERE follower_id = $1
      ) AS following,

      (
        SELECT COALESCE(SUM(views), 0)::int
        FROM posts
        WHERE user_id = $1
      ) AS views,

      (
        SELECT COALESCE(SUM(likes), 0)::int
        FROM posts
        WHERE user_id = $1
      ) AS likes
    `,
    [id]
  );

  const stats = result.rows[0];

  const payload = {
    userId: id,
    posts: Number(stats.posts),
    followers: Number(stats.followers),
    following: Number(stats.following),
    views: Number(stats.views),
    likes: Number(stats.likes),
    updatedAt: new Date().toISOString(),
  };

  // Update every browser viewing this public profile.
  io.to(`profile:${id}`).emit(
    "profile:stats-updated",
    payload
  );

  // Also update all authenticated sessions belonging to this user.
  io.to(`user:${id}`).emit(
    "profile:stats-updated",
    payload
  );

  return payload;
}

module.exports = { emitProfileStats };