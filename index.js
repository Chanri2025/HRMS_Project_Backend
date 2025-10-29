const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

// Load environment variables from .env if present.  The .env file
// should contain DB credentials and token secrets.  See
// `.env.example` for the required variables.
dotenv.config();

const { sequelize } = require("./config/database");
const { AuthUser, Role } = require("./models");

// Import route modules
const authRoutes = require("./routes/auth");
const attendanceRoutes = require("./routes/attendance");
const userRoutes = require("./routes/users");
const projectRoutes = require("./routes/projects");
const workEntryRoutes = require("./routes/work_entries");

async function startServer() {
  try {
    // Test the database connection.  This does not perform any
    // destructive operations and helps surface connection issues
    // early in the startup process.
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");
    // Optionally ensure models are in sync with the database schema.
    // In production you may want to disable sync or use migrations
    // instead to avoid unintentional schema changes.
    // await sequelize.sync();
  } catch (err) {
    console.error("Unable to connect to the database:", err);
  }
  const app = express();
  // Parse JSON request bodies
  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(cookieParser());
  // A simple health check route
  app.get("/", (req, res) => {
    res.send("SMSC API is running!");
  });
  // Mount routers under /auth, /attendance, /users, /projects, /work-entries
  app.use("/auth", authRoutes);
  app.use("/attendance", attendanceRoutes);
  app.use("/users", userRoutes);
  app.use("/projects", projectRoutes);
  app.use("/work-entries", workEntryRoutes);
  // Start the HTTP server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
