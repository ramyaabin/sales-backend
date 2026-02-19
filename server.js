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
import excelUploadRoute from "./routes/excelUploadRoute.js"; // ✅ ADDED

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
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://salesapp-c1xw.onrender.com",
      "https://salesapp-yqxl.onrender.com",
    ],
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
app.use("/api", excelUploadRoute); // ✅ ADDED — enables POST /api/upload-excel

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
  } catch {
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
  } catch {
    res.status(500).json({ error: "Failed to add user" });
  }
});

// ✅ ADDED — Password reset endpoint (called from api.js resetPassword())
app.put("/api/users/:salesmanId/password", async (req, res) => {
  try {
    const { salesmanId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const user = await User.findOneAndUpdate(
      { salesmanId },
      { password },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, user });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

app.delete("/api/users/:salesmanId", async (req, res) => {
  try {
    const { salesmanId } = req.params;
    await User.deleteOne({ salesmanId });
    await Sale.deleteMany({ salesmanId });
    await Leave.deleteMany({ salesmanId });
    res.json({ success: true });
  } catch {
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
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

/* ===================== PRODUCTS ===================== */
app.get("/api/products", async (req, res) => {
  try {
    const { search, brand, category } = req.query;

    // Build query — don't filter by isActive so legacy data without it still appears
    let query = {};

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { brand: regex },
        { Brand: regex },
        { description: regex },
        { itemCode: regex },
        { "Item Code": regex },
        { modelNumber: regex },
      ];
    }

    if (brand)
      query.$or = [
        { brand: new RegExp(brand, "i") },
        { Brand: new RegExp(brand, "i") },
      ];
    if (category) query.category = category;

    const raw = await Product.find(query).sort({ brand: 1 }).lean();

    // ✅ Normalize every product so the frontend always gets consistent fields
    // regardless of how/when data was originally uploaded
    const products = raw.map((p) => ({
      ...p,
      // itemCode — always a string so .toLowerCase() never crashes
      itemCode: String(
        p.itemCode || p["Item Code"] || p.itemcode || p.ItemCode || "",
      ),
      // brand — prefer lowercase field, fall back to capitalized
      brand: p.brand || p.Brand || "",
      // price — frontend reads p.price; map from rspVat if price missing
      price: p.price ?? p.rspVat ?? p[" RSP+Vat "] ?? p["RSP+Vat"] ?? 0,
      // description
      description:
        p.description || p.Description || p["Item Description"] || "",
      // modelNumber
      modelNumber: String(
        p.modelNumber || p["Model "] || p.Model || p.modelNo || "",
      ).trim(),
    }));

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch {
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

    res.json(await Sale.find(query).sort({ date: -1 }));
  } catch {
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

app.post("/api/sales", async (req, res) => {
  try {
    const sale = await Sale.create(req.body);
    // ✅ Return consistent shape — sale is always in result.sale
    res.status(201).json({ success: true, sale });
  } catch {
    res.status(500).json({ error: "Failed to add sale" });
  }
});

// ✅ ADDED — Delete a sale
app.delete("/api/sales/:id", async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete sale" });
  }
});

/* ===================== LEAVES ===================== */
app.get("/api/leaves", async (req, res) => {
  try {
    const { salesmanId, date, month } = req.query;
    let query = {};
    if (salesmanId) query.salesmanId = salesmanId;
    if (date) query.date = date;
    if (month) query.date = { $regex: `^${month}` }; // ✅ ADDED month filter

    res.json(await Leave.find(query).sort({ date: -1 }));
  } catch {
    res.status(500).json({ error: "Failed to fetch leaves" });
  }
});

app.post("/api/leaves", async (req, res) => {
  try {
    if (
      await Leave.findOne({
        salesmanId: req.body.salesmanId,
        date: req.body.date,
      })
    ) {
      return res.status(400).json({ error: "Leave already applied" });
    }

    const leave = await Leave.create(req.body);
    res.status(201).json({ success: true, leave });
  } catch {
    res.status(500).json({ error: "Failed to add leave" });
  }
});

// ✅ ADDED — Approve / Reject leave (used by admin dashboard)
app.patch("/api/leaves/:id", async (req, res) => {
  try {
    const updated = await Leave.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ error: "Leave not found" });
    }

    res.json({ success: true, leave: updated });
  } catch {
    res.status(500).json({ error: "Failed to update leave status" });
  }
});

// ✅ ADDED — Delete a leave
app.delete("/api/leaves/:id", async (req, res) => {
  try {
    await Leave.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
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
  } catch {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/* ===================== 404 ===================== */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* ===================== CONNECT DB & START SERVER ===================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    if (!(await User.findOne({ username: "gokul" }))) {
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
