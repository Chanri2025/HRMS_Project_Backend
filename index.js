const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const cors = require("cors"); // ✅ add this

dotenv.config();

const {sequelize} = require("./config/database");
const {AuthUser, Role} = require("./models");

// Import route modules
const authRoutes = require("./routes/auth");
const attendanceRoutes = require("./routes/attendance");
const userRoutes = require("./routes/users");
const projectRoutes = require("./routes/projects");
const workEntryRoutes = require("./routes/work_entries");

async function startServer() {
    try {
        await sequelize.authenticate();
        console.log("Database connection has been established successfully.");
    } catch (err) {
        console.error("Unable to connect to the database:", err);
    }

    const app = express();

    // ✅ CORS setup
    app.use(
        cors({
            origin: [
                "http://localhost:5173", // React Vite
                "http://localhost:3001"  // React CRA (fallback)
            ],
            credentials: true, // ✅ allow cookies, authorization headers
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "X-Requested-With",
                "Accept"
            ]
        })
    );

    // Middleware
    app.use(bodyParser.json({limit: "10mb"}));
    app.use(cookieParser());

    // Health check route
    app.get("/", (req, res) => {
        res.send("SMSC API is running!");
    });

    // Mount routers
    app.use("/auth", authRoutes);
    app.use("/attendance", attendanceRoutes);
    app.use("/users", userRoutes);
    app.use("/projects", projectRoutes);
    app.use("/work-entries", workEntryRoutes);

    // Start server
    const port = process.env.PORT || 5001;
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

startServer();
