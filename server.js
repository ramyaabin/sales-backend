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
console.log("MONGO_URI:", process.env.MONGO_URI);

/* ===================== VALIDATION ===================== */
if (!process.env.MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI is not set");
  process.exit(1);
}

/* ===================== APP ===================== */
const app = express();
const PORT = process.env.PORT || 5000;

/* ===================== CORS ===================== */
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());

/* ===================== LOGGING ===================== */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* ===================== ROUTES ===================== */
app.use("/api", uploadUsersRoute);

/* ===================== HEALTH ===================== */
app.get("/", (req, res) => {
  res.json({
    status: "running",
    environment: process.env.NODE_ENV || "development",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
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

/* ===================== START SERVER ===================== */
async function startServer() {
  try {
    /* ---------- CONNECT DB ---------- */
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ MongoDB connected");

    /* ===================== CREATE DEFAULT ADMIN ===================== */
    const createDefaultAdmin = async () => {
      try {
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
      } catch (err) {
        console.error("❌ Admin creation failed:", err);
      }
    };

    await createDefaultAdmin();

    /* ===================== USERS ===================== */
    app.get("/api/users", async (req, res) => {
      try {
        const users = await User.find().select("-__v");
        res.json(users);
      } catch (err) {
        console.error("Error fetching users:", err);
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

        const user = new User({
          username,
          password,
          name,
          role,
          salesmanId: role === "salesman" ? salesmanId : undefined,
        });

        await user.save();
        res.status(201).json({ success: true, user });
      } catch (err) {
        console.error("Error adding user:", err);
        res.status(500).json({ error: "Failed to add user" });
      }
    });

    app.delete("/api/users/:salesmanId", async (req, res) => {
      try {
        const { salesmanId } = req.params;

        const user = await User.findOne({ salesmanId });
        if (!user || user.role !== "salesman") {
          return res.status(404).json({ error: "Salesman not found" });
        }

        await User.deleteOne({ salesmanId });
        await Sale.deleteMany({ salesmanId });
        await Leave.deleteMany({ salesmanId });

        res.json({ success: true });
      } catch (err) {
        console.error("Error deleting user:", err);
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
        console.error("Error resetting password:", err);
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
        console.error("Error during login:", err);
        res.status(500).json({ error: "Login failed" });
      }
    });

    /* ===================== PRODUCTS ===================== */
    app.get("/api/products", async (req, res) => {
      try {
        const products = await Product.find();
        console.log(`✅ Products fetched: ${products.length} items`);
        res.json(products);
      } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({ error: "Failed to fetch products" });
      }
    });

    app.post("/api/products", async (req, res) => {
      try {
        const product = new Product(req.body);
        await product.save();
        console.log("✅ Product added:", product);
        res.status(201).json({ success: true, product });
      } catch (err) {
        console.error("Error adding product:", err);
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
        console.log(`✅ Sales fetched: ${sales.length} records`);
        res.json(sales);
      } catch (err) {
        console.error("Error fetching sales:", err);
        res.status(500).json({ error: "Failed to fetch sales" });
      }
    });

    app.post("/api/sales", async (req, res) => {
      try {
        const sale = new Sale(req.body);
        await sale.save();
        console.log("✅ Sale added:", sale);
        res.json({ success: true, sale });
      } catch (err) {
        console.error("Error adding sale:", err);
        res.status(500).json({ error: "Failed to add sale" });
      }
    });

    app.delete("/api/sales/:id", async (req, res) => {
      try {
        await Sale.findByIdAndDelete(req.params.id);
        res.json({ success: true });
      } catch (err) {
        console.error("Error deleting sale:", err);
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
        console.log(`✅ Leaves fetched: ${leaves.length} records`);
        res.json(leaves);
      } catch (err) {
        console.error("Error fetching leaves:", err);
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
          return res.status(400).json({ error: "Leave already applied for this date" });
        }

        const leave = new Leave(req.body);
        await leave.save();
        console.log("✅ Leave added:", leave);
        
        // CRITICAL FIX: Return the leave object so frontend can save it
        res.json({ success: true, leave });
      } catch (err) {
        console.error("Error adding leave:", err);
        res.status(500).json({ error: "Failed to add leave" });
      }
    });

    app.delete("/api/leaves/:id", async (req, res) => {
      try {
        await Leave.findByIdAndDelete(req.params.id);
        res.json({ success: true });
      } catch (err) {
        console.error("Error deleting leave:", err);
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

        const totalSalesmen = await User.countDocuments({ role: "salesman" });

        res.json({
          totalAmount,
          totalTransactions: sales.length,
          totalSalesmen,
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
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
