/* ===================== IMPORTS ===================== */
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import Product from "./models/Product.js";
import User from "./models/User.js";
import Sale from "./models/Sale.js";
import Leave from "./models/Leave.js";

import uploadUsersRoute from "./routes/uploadUsers.js";

/* ===================== ENV ===================== */
dotenv.config();

/* ===================== VALIDATION ===================== */
if (!process.env.MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI environment variable is not set!");
  console.error("Please set it in your Render dashboard → Environment");
  process.exit(1);
}

/* ===================== APP ===================== */
const app = express();
const PORT = process.env.PORT || 5000;

/* ===================== IMPROVED CORS MIDDLEWARE ===================== */
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  "https://sales-backend-r0xw.onrender.com",
  // Add your Netlify domain here when deployed
  "https://your-app-name.netlify.app",
  // Allow any Netlify preview URLs
  /\.netlify\.app$/,
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if origin is in allowedOrigins or matches regex
      const isAllowed =
        allowedOrigins.includes(origin) ||
        allowedOrigins.some(
          (pattern) => pattern instanceof RegExp && pattern.test(origin),
        );

      if (isAllowed || process.env.NODE_ENV === "development") {
        callback(null, true);
      } else {
        console.log(`⚠️  CORS blocked origin: ${origin}`);
        callback(null, true); // Still allow for now, but log
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

/* ===================== REQUEST LOGGING ===================== */
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

/* ===================== ROUTES ===================== */

// Excel upload users
app.use("/api", uploadUsersRoute);

// Health check - IMPROVED
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "HAMA Sales Tracker API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Test route with more details
app.get("/api/test", (req, res) => {
  res.json({
    message: "API working ✅",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected ✅" : "disconnected ❌",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

/* ===================== DATABASE CONNECTION ===================== */
async function startServer() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log(
      `📍 MongoDB URI: ${process.env.MONGO_URI.replace(/:[^:]*@/, ":****@")}`,
    ); // Hide password in logs

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Timeout after 10s instead of 30s
      socketTimeoutMS: 45000,
    });

    console.log("✅ MongoDB connected successfully!");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);

    /* ===================== PRODUCTS ===================== */
    app.get("/api/products", async (req, res) => {
      try {
        console.log("📦 Fetching products from database...");
        const products = await Product.find();
        console.log(`✅ Found ${products.length} products`);
        res.json(products);
      } catch (err) {
        console.error("❌ Error fetching products:", err);
        res.status(500).json({
          error: "Failed to fetch products",
          message: err.message,
          details:
            process.env.NODE_ENV === "development" ? err.stack : undefined,
        });
      }
    });

    app.post("/api/products", async (req, res) => {
      try {
        console.log("📦 Creating new product...");
        const product = new Product(req.body);
        await product.save();
        console.log("✅ Product created successfully");
        res.status(201).json(product);
      } catch (err) {
        console.error("❌ Error creating product:", err);
        res.status(500).json({
          error: "Failed to create product",
          message: err.message,
        });
      }
    });

    /* ===================== USERS ===================== */
    app.get("/api/users", async (req, res) => {
      try {
        console.log("👥 Fetching users from database...");
        const users = await User.find().select("-__v");
        console.log(`✅ Found ${users.length} users`);
        res.json(users);
      } catch (err) {
        console.error("❌ Error fetching users:", err);
        res.status(500).json({
          error: "Failed to fetch users",
          message: err.message,
        });
      }
    });

    app.post("/api/users", async (req, res) => {
      try {
        const { username, password, name, role, salesmanId } = req.body;

        console.log(`👤 Creating user: ${username} (${role})`);

        if (!username || !password || !name || !role) {
          return res.status(400).json({ error: "All fields required" });
        }

        const exists = await User.findOne({ username });
        if (exists) {
          console.log(`⚠️  Username already exists: ${username}`);
          return res.status(400).json({ error: "Username exists" });
        }

        const user = new User({
          username,
          password,
          name,
          role: role.toLowerCase(),
          salesmanId:
            role.toLowerCase() === "salesman" ? salesmanId : undefined,
        });

        await user.save();
        console.log(`✅ User created: ${username}`);
        res.status(201).json({ success: true, user });
      } catch (err) {
        console.error("❌ Error creating user:", err);
        res.status(500).json({
          error: "Failed to create user",
          message: err.message,
        });
      }
    });

    app.delete("/api/users/:salesmanId", async (req, res) => {
      try {
        const { salesmanId } = req.params;
        console.log(`🗑️  Deleting salesman: ${salesmanId}`);

        const user = await User.findOne({ salesmanId });
        if (!user) {
          console.log(`⚠️  User not found: ${salesmanId}`);
          return res.status(404).json({ error: "User not found" });
        }

        if (user.role !== "salesman") {
          console.log(`⚠️  Cannot delete non-salesman: ${salesmanId}`);
          return res
            .status(400)
            .json({ error: "Only salesmen can be deleted" });
        }

        await User.deleteOne({ salesmanId });
        await Sale.deleteMany({ salesmanId });
        await Leave.deleteMany({ salesmanId });

        console.log(`✅ Salesman deleted: ${salesmanId}`);
        res.json({
          success: true,
          message: "Salesman and related data deleted",
        });
      } catch (err) {
        console.error("❌ Error deleting user:", err);
        res.status(500).json({
          error: "Failed to delete user",
          message: err.message,
        });
      }
    });

    app.put("/api/users/:salesmanId/password", async (req, res) => {
      try {
        const { salesmanId } = req.params;
        const { password } = req.body;

        console.log(`🔐 Resetting password for: ${salesmanId}`);

        if (!password || password.length < 6) {
          return res.status(400).json({
            error: "Password must be at least 6 characters",
          });
        }

        const user = await User.findOne({ salesmanId });
        if (!user) {
          console.log(`⚠️  User not found: ${salesmanId}`);
          return res.status(404).json({ error: "User not found" });
        }

        user.password = password;
        await user.save();

        console.log(`✅ Password reset for: ${salesmanId}`);
        res.json({ success: true, message: "Password updated" });
      } catch (err) {
        console.error("❌ Error resetting password:", err);
        res.status(500).json({
          error: "Failed to reset password",
          message: err.message,
        });
      }
    });

    app.post("/api/login", async (req, res) => {
      try {
        const { username, password } = req.body;
        console.log(`🔑 Login attempt: ${username}`);

        const user = await User.findOne({ username, password });

        if (!user) {
          console.log(`⚠️  Invalid credentials for: ${username}`);
          return res.status(401).json({ error: "Invalid credentials" });
        }

        console.log(`✅ Login successful: ${username}`);
        res.json({ success: true, user });
      } catch (err) {
        console.error("❌ Login error:", err);
        res.status(500).json({
          error: "Login failed",
          message: err.message,
        });
      }
    });

    /* ===================== SALES ===================== */
    app.get("/api/sales", async (req, res) => {
      try {
        const { salesmanId, date, month } = req.query;
        console.log(
          `💰 Fetching sales - salesmanId: ${salesmanId}, date: ${date}, month: ${month}`,
        );

        let query = {};
        if (salesmanId) query.salesmanId = salesmanId;
        if (date) query.date = date;
        if (month) query.date = { $regex: `^${month}` };

        const sales = await Sale.find(query).sort({ date: -1 });
        console.log(`✅ Found ${sales.length} sales records`);
        res.json(sales);
      } catch (err) {
        console.error("❌ Error fetching sales:", err);
        res.status(500).json({
          error: "Failed to fetch sales",
          message: err.message,
        });
      }
    });

    app.post("/api/sales", async (req, res) => {
      try {
        console.log("💰 Recording new sale...");
        const sale = new Sale(req.body);
        await sale.save();
        console.log("✅ Sale recorded successfully");
        res.json({ success: true, sale });
      } catch (err) {
        console.error("❌ Error recording sale:", err);
        res.status(500).json({
          error: "Failed to record sale",
          message: err.message,
        });
      }
    });

    app.delete("/api/sales/:id", async (req, res) => {
      try {
        console.log(`🗑️  Deleting sale: ${req.params.id}`);
        await Sale.findByIdAndDelete(req.params.id);
        console.log("✅ Sale deleted");
        res.json({ success: true, message: "Sale deleted" });
      } catch (err) {
        console.error("❌ Error deleting sale:", err);
        res.status(500).json({
          error: "Failed to delete sale",
          message: err.message,
        });
      }
    });

    /* ===================== LEAVES ===================== */
    app.get("/api/leaves", async (req, res) => {
      try {
        console.log("🏖️  Fetching leaves...");
        const leaves = await Leave.find(req.query).sort({ date: -1 });
        console.log(`✅ Found ${leaves.length} leave records`);
        res.json(leaves);
      } catch (err) {
        console.error("❌ Error fetching leaves:", err);
        res.status(500).json({
          error: "Failed to fetch leaves",
          message: err.message,
        });
      }
    });

    app.post("/api/leaves", async (req, res) => {
      try {
        console.log(
          `🏖️  Processing leave application for ${req.body.salesmanId}`,
        );

        const exists = await Leave.findOne({
          salesmanId: req.body.salesmanId,
          date: req.body.date,
        });

        if (exists) {
          console.log("⚠️  Leave already applied for this date");
          return res.status(400).json({
            error: "Leave already applied for this date",
          });
        }

        const leave = new Leave(req.body);
        await leave.save();
        console.log("✅ Leave application saved");
        res.json({ success: true, leave });
      } catch (err) {
        console.error("❌ Error saving leave:", err);
        res.status(500).json({
          error: "Failed to save leave",
          message: err.message,
        });
      }
    });

    app.delete("/api/leaves/:id", async (req, res) => {
      try {
        console.log(`🗑️  Deleting leave: ${req.params.id}`);
        await Leave.findByIdAndDelete(req.params.id);
        console.log("✅ Leave deleted");
        res.json({ success: true, message: "Leave deleted" });
      } catch (err) {
        console.error("❌ Error deleting leave:", err);
        res.status(500).json({
          error: "Failed to delete leave",
          message: err.message,
        });
      }
    });

    /* ===================== STATS ===================== */
    app.get("/api/stats", async (req, res) => {
      try {
        console.log("📊 Calculating stats...");

        const sales = await Sale.find();
        const totalAmount = sales.reduce(
          (sum, s) => sum + (s.totalAmount || s.quantity * s.price),
          0,
        );

        const totalSalesmen = await User.countDocuments({ role: "salesman" });

        console.log(`✅ Stats calculated - Total: AED ${totalAmount}`);
        res.json({
          totalAmount,
          totalTransactions: sales.length,
          totalSalesmen,
        });
      } catch (err) {
        console.error("❌ Error calculating stats:", err);
        res.status(500).json({
          error: "Failed to calculate stats",
          message: err.message,
        });
      }
    });

    /* ===================== ERROR HANDLING ===================== */
    app.use((err, req, res, next) => {
      console.error("❌ Unhandled error:", err);
      res.status(500).json({
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development"
            ? err.message
            : "An error occurred",
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    });

    app.use((req, res) => {
      console.log(`⚠️  404 - Route not found: ${req.method} ${req.url}`);
      res.status(404).json({
        error: "Route not found",
        path: req.url,
        method: req.method,
      });
    });

    /* ===================== START SERVER ===================== */
    app.listen(PORT, () => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ Server is running!");
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🗄️  Database: ${mongoose.connection.db.databaseName}`);
      console.log(
        `📡 MongoDB: ${mongoose.connection.readyState === 1 ? "Connected ✅" : "Disconnected ❌"}`,
      );
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log("⚠️  SIGTERM received, closing server...");
      mongoose.connection.close();
      process.exit(0);
    });
  } catch (err) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ FATAL ERROR - Failed to start server!");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("Error details:", err.message);
    console.error("Stack trace:", err.stack);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (err.name === "MongoServerError") {
      console.error("\n🔍 MongoDB Error Detected!");
      console.error("Common causes:");
      console.error("1. Wrong credentials in MONGO_URI");
      console.error("2. IP address not whitelisted in MongoDB Atlas");
      console.error("3. Database user doesn't have proper permissions");
      console.error("4. Network connectivity issues");
    }

    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Promise Rejection:", reason);
  console.error("Promise:", promise);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

startServer();
