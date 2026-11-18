require("dotenv").config();

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const pool = require("./config/db");
const { upload, uploadToCloudinary } = require("./config/cloudinary");
const authenticateToken = require("./middleware/auth.middleware");
const { optionalAuthenticateToken } = require("./middleware/auth.middleware");
//block feature middlewere
const createBlockMiddleware = require("./middleware/block.middleware");
const { canViewProfile } = require("./utils/privacy.utils");

const { uploadSingleImage } = require("./middleware/upload.middleware");
const {
  slugify,
  generateExcerpt,
  POST_SELECT,
} = require("./utils/post.utils");
const {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} = require("./utils/cloudinary.utils");
const createApp = require("./app");
const nodemailer = require("nodemailer");

// Socket.IO imports using CommonJS
const { createServer } = require("http");
const { Server } = require("socket.io");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in .env");
}

if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is missing in .env");
}

const PORT = process.env.PORT || 5000;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const blockMiddleware = createBlockMiddleware(pool);

const deps = {
  pool,
  ...blockMiddleware,
  crypto,
  bcrypt,
  jwt,
  googleClient,
  authenticateToken,
  upload,
  uploadToCloudinary,
  uploadSingleImage,
  uploadBufferToCloudinary,
  deleteFromCloudinary,
  slugify,
  generateExcerpt,
  POST_SELECT,
  mailer,
  optionalAuthenticateToken,
};

const app = createApp(deps);

// Create one HTTP server from your existing Express app
const httpServer = createServer(app);

const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Attach Socket.IO to the same HTTP server used by Express.
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Authenticate Socket.IO connections when a token is supplied. Anonymous
// connections remain possible for public post rooms, but cannot join user rooms.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    socket.data.userId = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const userId = Number(decoded.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return next(new Error("Unauthorized socket connection"));
    }

    socket.data.userId = userId;
    return next();
  } catch (error) {
    return next(new Error("Unauthorized socket connection"));
  }
});

// Make Socket.IO available inside Express routes.
app.set("io", io);

// Handle post and authenticated user room subscriptions.
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("post:join", async (postId) => {
    const id = Number(postId);
  
    if (!Number.isInteger(id) || id <= 0) {
      console.warn("Invalid post room ID:", postId);
      return;
    }
  
    try {
      const result = await pool.query(
        `
        SELECT user_id
        FROM posts
        WHERE id = $1
          AND published_at IS NOT NULL
        `,
        [id]
      );
    
      if (result.rows.length === 0) return;
    
      // Enforce the same public/private and block rules as the HTTP API.
      const allowed = await canViewProfile(
        pool,
        socket.data.userId,
        result.rows[0].user_id
      );
      if (!allowed) {
        socket.emit("post:room-error", { error: "Post not found" });
        return;
      }

      await socket.join(`post:${id}`);
    
      console.log(`Socket ${socket.id} joined post:${id}`);
    } catch (error) {
      console.error("Post room join error:", error);
    }
  });

  socket.on("post:leave", (postId) => {
    const id = Number(postId);

    if (!Number.isInteger(id) || id <= 0) return;

    socket.leave(`post:${id}`);

    console.log(`Socket ${socket.id} left post:${id}`);
  });

  socket.on("user:join", (requestedUserId, acknowledge) => {
    const userId = Number(requestedUserId);

    const reply =
      typeof acknowledge === "function" ? acknowledge : null;

    // Only allow the authenticated user to join their own room.
    if (!socket.data.userId || userId !== socket.data.userId) {
      const error = "Unauthorized user room";

      reply?.({ ok: false, error });

      socket.emit("user:room-error", { error });
      return;
    }

    // Acknowledge only after the room has been joined.
    Promise.resolve(socket.join(`user:${userId}`))
      .then(() => {
        reply?.({ ok: true });

        console.log(
          `Socket ${socket.id} joined user:${userId}`
        );
      })
      .catch((error) => {
        console.error("Failed to join user room:", error);

        reply?.({
          ok: false,
          error: "Failed to join user room",
        });
      });
  });

  socket.on("user:leave", (requestedUserId) => {
    const userId = Number(requestedUserId);

    if (!socket.data.userId || userId !== socket.data.userId) return;

    socket.leave(`user:${userId}`);
  });

  // Public profile room for realtime profile statistics.
  // Profile statistics are public, but private user rooms remain protected.
  socket.on("profile:join", async (requestedUserId, acknowledge) => {
    const userId = Number(requestedUserId);
  
    const reply =
      typeof acknowledge === "function" ? acknowledge : () => {};
  
    if (!Number.isInteger(userId) || userId <= 0) {
      return reply({
        ok: false,
        error: "Invalid profile ID",
      });
    }
  
    try {
      if (socket.data.userId) {
        const blocked = await blockMiddleware.isBlockedBetween(
          socket.data.userId,
          userId
        );
      
        if (blocked) {
          return reply({
            ok: false,
            error: "Profile not found",
          });
        }
      }
      
      await socket.join(`profile:${userId}`);
    
      console.log(
        `Socket ${socket.id} joined profile:${userId}`
      );
    
      reply({ ok: true });
    } catch (error) {
      console.error("Profile room join error:", error);
    
      reply({
        ok: false,
        error: "Unable to join profile room",
      });
    }
  });
  
  socket.on("profile:leave", (requestedUserId) => {
    const userId = Number(requestedUserId);
  
    if (!Number.isInteger(userId) || userId <= 0) return;
  
    socket.leave(`profile:${userId}`);
  
    console.log(
      `Socket ${socket.id} left profile:${userId}`
    );
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `Socket disconnected: ${socket.id}`,
      reason
    );
  });
});

// Check PostgreSQL connection
pool
  .query("SELECT NOW()")
  .then(() => console.log("PostgreSQL connected"))
  .catch((err) =>
    console.error("PostgreSQL connection error:", err)
  );

// IMPORTANT: listen on httpServer, NOT app.listen()
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
