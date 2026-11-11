const express = require("express");
const cors = require("cors");

const registerNotificationsRoutes = require("./routes/notifications.routes");
const registerAuthRoutes = require("./routes/auth.routes");
const registerCommentsRoutes = require("./routes/comments.routes");
const registerBookmarksRoutes = require("./routes/bookmarks.routes");
const registerPostsRoutes = require("./routes/posts.routes");
const registerFollowsRoutes = require("./routes/follows.routes");
const registerUsersRoutes = require("./routes/users.routes");
const registerSearchRoutes = require("./routes/search.routes");
const registerHealthRoutes = require("./routes/health.routes");
const registerAccountRoutes = require("./routes/account.routes");

function createApp(deps) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Register the feature modules. Each module owns its route handlers.
  registerNotificationsRoutes(app, deps);
  registerAuthRoutes(app, deps);
  registerCommentsRoutes(app, deps);
  registerBookmarksRoutes(app, deps);
  registerPostsRoutes(app, deps);
  registerFollowsRoutes(app, deps);
  registerUsersRoutes(app, deps);
  registerAccountRoutes(app, deps);
  registerSearchRoutes(app, deps);
  registerHealthRoutes(app, deps);

  app.use((req, res) => res.status(404).json({ error: "Route not found" }));
  app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}

module.exports = createApp;
