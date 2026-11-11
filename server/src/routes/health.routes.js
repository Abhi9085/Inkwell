// Routes for health. Keep route handlers in this feature module.
module.exports = function registerHealthRoutes(app, deps) {
  const { pool } = deps;

  app.get("/api/health", async (req, res) => {
  
    try {
  
      await pool.query("SELECT 1");
  
  
  
      res.json({
  
        status: "ok",
  
        database: "connected",
  
      });
  
    } catch (error) {
  
      res.status(500).json({
  
        status: "error",
  
        database: "disconnected",
  
      });
  
    }
  
  });
};
