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

/* ===================== APP ===================== */
const app = express();
const PORT = 5000;

/* ===================== MIDDLEWARE ===================== */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:5174",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

/* ===================== ROUTES (ALWAYS AVAILABLE) ===================== */

// Excel upload users (SAFE – does NOT delete existing users)
app.use("/api", uploadUsersRoute);

// Health check
app.get("/api/test", (req, res) => {
  res.json({ message: "API working ✅" });
});

/* ===================== START SERVER ===================== */
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    /* ===================== PRODUCTS ===================== */
    app.get("/api/products", async (req, res) => {
      try {
        const products = await Product.find();
        res.json(products);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /* ===================== USERS ===================== */

    // Get all users (admins + salesmen)
    app.get("/api/users", async (req, res) => {
      try {
        const users = await User.find().select("-__v");
        res.json(users);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Add user / salesman
    app.post("/api/users", async (req, res) => {
      try {
        const { username, password, name, role, salesmanId } = req.body;

        if (!username || !password || !name || !role) {
          return res.status(400).json({ error: "All fields required" });
        }

        const exists = await User.findOne({ username });
        if (exists) {
          return res.status(400).json({ error: "Username already exists" });
        }

        const user = new User({
          username,
          password, // ⚠️ plaintext for demo only
          name,
          role: role.toLowerCase(),
          salesmanId:
            role.toLowerCase() === "salesman" ? salesmanId : undefined,
        });

        await user.save();
        res.status(201).json(user);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Delete salesman ONLY
    app.delete("/api/users/:id", async (req, res) => {
      try {
        const user = await User.findById(req.params.id);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        if (user.role !== "salesman") {
          return res
            .status(400)
            .json({ message: "Only salesmen can be deleted" });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: "Salesman deleted successfully" });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // Login
    app.post("/api/login", async (req, res) => {
      try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });

        if (!user) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        res.json({ success: true, user });
      } catch (err) {
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/sales", async (req, res) => {
      try {
        const sale = new Sale(req.body);
        await sale.save();
        res.json({ success: true, sale });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /* ===================== LEAVES ===================== */
    app.get("/api/leaves", async (req, res) => {
      try {
        const leaves = await Leave.find(req.query);
        res.json(leaves);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/leaves", async (req, res) => {
      try {
        const exists = await Leave.findOne({
          salesmanId: req.body.salesmanId,
          date: req.body.date,
        });

        if (exists) {
          return res.status(400).json({ error: "Leave already applied" });
        }

        const leave = new Leave(req.body);
        await leave.save();
        res.json({ success: true, leave });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /* ===================== SYNC SALESMEN (IMPORTANT FIX) ===================== */
    // This fixes: "Admin dashboard shows salesmen but Manage Team shows 0"
    app.post("/api/sync-salesmen", async (req, res) => {
      try {
        const salesmanIds = await Sale.distinct("salesmanId");
        let created = 0;

        for (const id of salesmanIds) {
          if (!id) continue;

          const exists = await User.findOne({ salesmanId: id });
          if (!exists) {
            await User.create({
              name: id,
              username: id.toLowerCase(),
              password: "1234",
              role: "salesman",
              salesmanId: id,
            });
            created++;
          }
        }

        res.json({
          message: "Salesmen synced successfully",
          created,
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
      }
    });

    /* ===================== START ===================== */
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`🧪 Test: http://localhost:${PORT}/api/test`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed", err);
    process.exit(1);
  }
}

startServer();
