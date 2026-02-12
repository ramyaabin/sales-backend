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

/* ===================== ENV CONFIG ===================== */
dotenv.config();

if (!process.env.MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI is not set in environment variables");
  process.exit(1);
}

/* ===================== APP INIT ===================== */
const app = express();
const PORT = process.env.PORT || 5000;

/* ===================== CORS ===================== */
app.use(
  cors({
    origin: ["http://localhost:5173", "https://salesapp-c1xw.onrender.com"],
    credentials: true,
  }),
);

app.use(express.json());

/* ===================== REQUEST LOG ===================== */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* ===================== ROUTES ===================== */
app.use("/api", uploadUsersRoute);

/* ===================== HEALTH CHECK ===================== */
app.get("/", (req, res) => {
  res.json({
    status: "running",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected ✅" : "disconnected ❌",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "API working ✅",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected ✅" : "disconnected ❌",
  });
});

/* ===================== START SERVER FIRST ===================== */
app.listen(PORT, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

/* ===================== CONNECT TO MONGODB ===================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    // Create default admin if not exists
    const exists = await User.findOne({ username: "gokul" });

    if (!exists) {
      await User.create({
        username: "gokul",
        password: "admin123",
        name: "Gokul",
        role: "admin",
        email: "admin@gmail.com",
      });
      console.log("✅ Default admin created");
    } else {
      console.log("ℹ️ Default admin already exists");
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
  });

    /* ===================== USERS ===================== */
    app.get("/api/users", async (req, res) => {
      try {
        const users = await User.find().select("-__v");
        res.json(users);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });

    app.post("/api/users", async (req, res) => {
      try {
        const { username, password, name, role, salesmanId } = req.body;

        if (!username || !password || !name || !role) {
          return res.status(400).json({ error: "All fields required" });
        }

        const exists = await User.findOne({ username });
        if (exists) {
          return res.status(400).json({ error: "Username exists" });
        }

        const user = await User.create({
          username,
          password,
          name,
          role,
          salesmanId: role === "salesman" ? salesmanId : undefined,
        });

        res.status(201).json({ success: true, user });
      } catch (err) {
        res.status(500).json({ error: "Failed to add user" });
      }
    });

    app.delete("/api/users/:salesmanId", async (req, res) => {
      try {
        const { salesmanId } = req.params;

        await User.deleteOne({ salesmanId });
        await Sale.deleteMany({ salesmanId });
        await Leave.deleteMany({ salesmanId });

        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: "Failed to delete user" });
      }
    });

    app.put("/api/users/:salesmanId/password", async (req, res) => {
      try {
        const { salesmanId } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
          return res
            .status(400)
            .json({ error: "Password must be at least 6 characters" });
        }

        const user = await User.findOne({ salesmanId });
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        user.password = password;
        await user.save();

        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: "Failed to reset password" });
      }
    });

    /* ===================== LOGIN ===================== */
    app.post("/api/login", async (req, res) => {
      try {
        const { username, password } = req.body;

        const user = await User.findOne({ username, password });
        if (!user) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        res.json({ success: true, user });
      } catch (err) {
        res.status(500).json({ error: "Login failed" });
      }
    });

    /* ===================== PRODUCTS ===================== */
    app.get("/api/products", async (req, res) => {
      try {
        const products = await Product.find();
        res.json(products);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch products" });
      }
    });

    app.post("/api/products", async (req, res) => {
      try {
        const product = await Product.create(req.body);
        res.status(201).json({ success: true, product });
      } catch (err) {
        res.status(500).json({ error: "Failed to add product" });
      }
    });

    /* ===================== SALES ===================== */
    app.get("/api/sales", async (req, res) => {
      try {
        const { salesmanId, date, month } = req.query;
        let query = {};

        if (salesmanId) query.salesmanId = salesmanId;
        if (date) query.date = date;
        if (month) query.date = { $regex: `^${month}` };

        const sales = await Sale.find(query).sort({ date: -1 });
        res.json(sales);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch sales" });
      }
    });

    app.post("/api/sales", async (req, res) => {
      try {
        const sale = await Sale.create(req.body);
        res.json({ success: true, sale });
      } catch (err) {
        res.status(500).json({ error: "Failed to add sale" });
      }
    });

    app.delete("/api/sales/:id", async (req, res) => {
      try {
        await Sale.findByIdAndDelete(req.params.id);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: "Failed to delete sale" });
      }
    });

    /* ===================== LEAVES ===================== */
    app.get("/api/leaves", async (req, res) => {
      try {
        const { salesmanId, date } = req.query;
        let query = {};

        if (salesmanId) query.salesmanId = salesmanId;
        if (date) query.date = date;

        const leaves = await Leave.find(query).sort({ date: -1 });
        res.json(leaves);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch leaves" });
      }
    });

    app.post("/api/leaves", async (req, res) => {
      try {
        const exists = await Leave.findOne({
          salesmanId: req.body.salesmanId,
          date: req.body.date,
        });

        if (exists) {
          return res
            .status(400)
            .json({ error: "Leave already applied for this date" });
        }

        const leave = await Leave.create(req.body);
        res.json({ success: true, leave });
      } catch (err) {
        res.status(500).json({ error: "Failed to add leave" });
      }
    });

    app.delete("/api/leaves/:id", async (req, res) => {
      try {
        await Leave.findByIdAndDelete(req.params.id);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: "Failed to delete leave" });
      }
    });

    /* ===================== STATS ===================== */
    app.get("/api/stats", async (req, res) => {
      try {
        const sales = await Sale.find();

        const totalAmount = sales.reduce(
          (sum, s) => sum + (s.totalAmount || s.quantity * s.price),
          0,
        );

        const totalSalesmen = await User.countDocuments({
          role: "salesman",
        });

        res.json({
          totalAmount,
          totalTransactions: sales.length,
          totalSalesmen,
        });
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch stats" });
      }
    });

    /* ===================== 404 ===================== */
    app.use((req, res) => {
      res.status(404).json({
        error: "Route not found",
        path: req.url,
      });
    });

    /* ===================== LISTEN ===================== */
    app.listen(PORT, () => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`🚀 Server running on port ${PORT}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    });
  } catch (err) {
    console.error("❌ Server startup failed:", err);
    process.exit(1);
  }
}

startServer();
