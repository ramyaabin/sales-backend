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

if (!process.env.MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI not set");
  process.exit(1);
}

/* ===================== APP INIT ===================== */
const app = express();
const PORT = process.env.PORT || 5000;

/* ===================== CORS ===================== */
/* This allows both localhost and ANY deployed frontend */
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());

/* ===================== REQUEST LOG ===================== */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

/* ===================== ROUTES ===================== */
app.use("/api", uploadUsersRoute);

/* ===================== HEALTH ===================== */
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

/* ===================== USERS ===================== */
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().select("-__v");
    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { username, password, name, role, salesmanId } = req.body;

    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: "All fields required" });
    }

    if (await User.findOne({ username })) {
      return res.status(400).json({ error: "Username already exists" });
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
    console.error("❌ Error adding user:", err.message);
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
    console.error("❌ Error deleting user:", err.message);
    res.status(500).json({ error: "Failed to delete user" });
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
    console.error("❌ Error during login:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

/* ===================== PRODUCTS ===================== */
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    console.error("❌ Error fetching products:", err.message);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error("❌ Error adding product:", err.message);
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
    console.error("❌ Error fetching sales:", err.message);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

app.post("/api/sales", async (req, res) => {
  try {
    console.log("📥 Sale received:", req.body);

    const sale = await Sale.create(req.body);

    console.log("✅ Sale saved:", sale._id);

    res.json({ success: true, sale });
  } catch (err) {
    console.error("❌ Error adding sale:", err.message);
    res.status(500).json({ error: "Failed to add sale" });
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
    console.error("❌ Error fetching leaves:", err.message);
    res.status(500).json({ error: "Failed to fetch leaves" });
  }
});

app.post("/api/leaves", async (req, res) => {
  try {
    console.log("📥 Leave received:", req.body);

    const exists = await Leave.findOne({
      salesmanId: req.body.salesmanId,
      date: req.body.date,
    });

    if (exists) {
      return res.status(400).json({ error: "Leave already applied" });
    }

    const leave = await Leave.create(req.body);

    console.log("✅ Leave saved:", leave._id);

    res.json({ success: true, leave });
  } catch (err) {
    console.error("❌ Error adding leave:", err.message);
    res.status(500).json({ error: "Failed to add leave" });
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

    const totalSalesmen = await User.countDocuments({ role: "salesman" });

    res.json({
      totalAmount,
      totalTransactions: sales.length,
      totalSalesmen,
    });
  } catch (err) {
    console.error("❌ Error fetching stats:", err.message);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/* ===================== 404 ===================== */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* ===================== CONNECT DB ===================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    const adminExists = await User.findOne({ username: "gokul" });

    if (!adminExists) {
      await User.create({
        username: "gokul",
        password: "admin123",
        name: "Gokul",
        role: "admin",
        email: "admin@gmail.com",
      });

      console.log("✅ Default admin created");
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
