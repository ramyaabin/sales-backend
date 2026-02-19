/* ===================== IMPORTS ===================== */
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import nodemailer from "nodemailer";
import crypto from "crypto";
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

/* ===================== OTP STORE ===================== */
// In-memory store: { username: { otp, expiry } }
const otpStore = new Map();

const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

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

/* ===================== FORGOT PASSWORD (OTP) ===================== */

// Step 1: Request OTP — only works for admin accounts with an email set
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username)
      return res.status(400).json({ error: "Username is required" });

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "admin") {
      return res
        .status(403)
        .json({
          error:
            "Password reset via OTP is only available for admin accounts. Contact your admin to reset your password.",
        });
    }
    if (!user.email) {
      return res
        .status(400)
        .json({
          error:
            "No email address on file for this account. Contact your administrator.",
        });
    }
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res
        .status(500)
        .json({
          error:
            "Email service not configured on server. Set GMAIL_USER and GMAIL_APP_PASSWORD in environment.",
        });
    }

    // Generate 6-digit OTP, valid 10 minutes
    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(username.toLowerCase(), {
      otp,
      expiry: Date.now() + 10 * 60 * 1000,
    });

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"HAMA Sales App" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: "Your Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #cc0000; margin-bottom: 8px;">HAMA Sales Tracker</h2>
          <p style="color: #333; font-size: 15px;">You requested a password reset for the admin account <strong>${username}</strong>.</p>
          <div style="background: #f5f5f5; border-radius: 6px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 8px; color: #666; font-size: 13px;">Your one-time password (OTP)</p>
            <p style="margin: 0; font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #cc0000;">${otp}</p>
          </div>
          <p style="color: #666; font-size: 13px;">This OTP expires in <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    console.log("✅ OTP sent to", user.email, "for user", username);
    // Return masked email so frontend can show "sent to g***@gmail.com"
    const masked = user.email.replace(/(.{1}).+(@.+)/, "$1***$2");
    res.json({ success: true, maskedEmail: masked });
  } catch (err) {
    console.error("❌ Forgot password error:", err.message);
    res.status(500).json({ error: "Failed to send OTP: " + err.message });
  }
});

// Step 2: Verify OTP
app.post("/api/verify-otp", async (req, res) => {
  try {
    const { username, otp } = req.body;
    if (!username || !otp)
      return res.status(400).json({ error: "Username and OTP required" });

    const stored = otpStore.get(username.toLowerCase());
    if (!stored)
      return res
        .status(400)
        .json({ error: "No OTP requested for this account" });
    if (Date.now() > stored.expiry) {
      otpStore.delete(username.toLowerCase());
      return res
        .status(400)
        .json({ error: "OTP has expired. Please request a new one." });
    }
    if (stored.otp !== otp.trim()) {
      return res
        .status(400)
        .json({ error: "Invalid OTP. Please check and try again." });
    }

    // OTP valid — mark as verified so reset step can proceed
    otpStore.set(username.toLowerCase(), { ...stored, verified: true });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Verify OTP error:", err.message);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// Step 3: Reset password (only if OTP was verified)
app.post("/api/reset-password-otp", async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword)
      return res
        .status(400)
        .json({ error: "Username and new password required" });
    if (newPassword.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });

    const stored = otpStore.get(username.toLowerCase());
    if (!stored || !stored.verified) {
      return res
        .status(403)
        .json({
          error: "OTP not verified. Please complete verification first.",
        });
    }

    const user = await User.findOneAndUpdate(
      { username: username.toLowerCase() },
      { password: newPassword },
      { new: true },
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    otpStore.delete(username.toLowerCase());
    console.log("✅ Password reset via OTP for", username);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Reset password error:", err.message);
    res.status(500).json({ error: "Failed to reset password" });
  }
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
    const {
      salesmanId,
      salesmanName,
      date,
      brand,
      itemCode,
      quantity,
      price,
      totalAmount,
    } = req.body;

    if (!salesmanId)
      return res.status(400).json({ error: "salesmanId is required" });
    if (!salesmanName)
      return res.status(400).json({ error: "salesmanName is required" });
    if (!date) return res.status(400).json({ error: "date is required" });
    if (!brand) return res.status(400).json({ error: "brand is required" });
    if (!itemCode)
      return res.status(400).json({ error: "itemCode is required" });
    if (!quantity)
      return res.status(400).json({ error: "quantity is required" });
    if (!price) return res.status(400).json({ error: "price is required" });

    const sale = await Sale.create({
      salesmanId,
      salesmanName,
      date,
      brand,
      itemCode: String(itemCode),
      quantity: Number(quantity),
      price: Number(price),
      totalAmount: Number(totalAmount || quantity * price),
    });

    res.status(201).json({ success: true, sale });
  } catch (err) {
    console.error("❌ Failed to add sale:", err.message, err);
    res.status(500).json({ error: err.message || "Failed to add sale" });
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
    const { salesmanId, salesmanName, date, reason } = req.body;

    // ✅ Validate required fields explicitly with clear error messages
    if (!salesmanId)
      return res
        .status(400)
        .json({
          error:
            "salesmanId is required. The logged-in user may not have a salesmanId assigned.",
        });
    if (!salesmanName)
      return res.status(400).json({ error: "salesmanName is required" });
    if (!date) return res.status(400).json({ error: "date is required" });
    if (!reason) return res.status(400).json({ error: "reason is required" });

    // Check for duplicate
    const existing = await Leave.findOne({ salesmanId, date });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Leave already applied for this date" });
    }

    // ✅ Build leave explicitly (ignore frontend timestamp — let schema default handle it)
    const leave = await Leave.create({
      salesmanId,
      salesmanName,
      date,
      reason,
      status: "Pending",
    });

    res.status(201).json({ success: true, leave });
  } catch (err) {
    // ✅ Log and return the real error so it's visible in Render logs + browser
    console.error("❌ Failed to add leave:", err.message, err);
    res.status(500).json({ error: err.message || "Failed to add leave" });
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

    // ✅ Drop stale index from old schema that used fromDate instead of date.
    // This index causes E11000 duplicate key errors on every leave insert.
    try {
      await Leave.collection.dropIndex("salesmanId_1_fromDate_1");
      console.log("✅ Dropped stale leaves index: salesmanId_1_fromDate_1");
    } catch (e) {
      // Index may not exist on fresh deployments — that is fine
      if (e.code !== 27)
        console.warn("⚠️ Could not drop stale index:", e.message);
    }

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
