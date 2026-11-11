
module.exports = function createBlockMiddleware(pool) {
  // Check whether either user has blocked the other.
  const isBlockedBetween = async (userA, userB) => {
    const idA = Number(userA);
    const idB = Number(userB);

    if (
      !Number.isInteger(idA) || idA <= 0 ||
      !Number.isInteger(idB) || idB <= 0
    ) {
      return false;
    }

    if (idA === idB) return false;

    const result = await pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
       ) AS blocked`,
      [idA, idB]
    );

    return result.rows[0].blocked;
  };

  // Reusable Express middleware for routes with both user IDs available.
  const blockGuard = (getUserIds, options = {}) => {
    const {
      statusCode = 404,
      message = "Resource not found",
    } = options;

    return async (req, res, next) => {
      try {
        const [userA, userB] = getUserIds(req);

        if (!userA || !userB) {
          return next();
        }

        const blocked = await isBlockedBetween(userA, userB);

        if (blocked) {
          return res.status(statusCode).json({
            error: message,
          });
        }

        return next();
      } catch (error) {
        return next(error);
      }
    };
  };

  return {
    isBlockedBetween,
    blockGuard,
  };
};
