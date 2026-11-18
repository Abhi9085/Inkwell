const jwt = require("jsonwebtoken");

function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return next();
  }

  jwt.verify(parts[1], process.env.JWT_SECRET, { algorithms: ["HS256"] }, (err, user) => {
    if (!err) {
      req.user = user;
    }

    next();
  });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token required" });
  }
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Invalid authorization format" });
  }
  jwt.verify(parts[1], process.env.JWT_SECRET, { algorithms: ["HS256"] }, (err, user) => {
    if (err) return res.status(401).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
module.exports.optionalAuthenticateToken = optionalAuthenticateToken;
