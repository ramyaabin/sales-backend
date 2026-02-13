// routes/uploadSales.js
import express from "express";
import Sale from "../models/Sale.js";

const router = express.Router();

// Add a sale
router.post("/", async (req, res) => {
  try {
    const sale = await Sale.create(req.body);
    res.status(201).json({ success: true, sale });
  } catch (err) {
    console.error("Error adding sale:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all sales (optionally filtered)
router.get("/", async (req, res) => {
  try {
    const query = {};
    if (req.query.salesmanId) query.salesmanId = req.query.salesmanId;
    if (req.query.date) query.date = req.query.date;
    const sales = await Sale.find(query).sort({ timestamp: -1 });
    res.json(sales);
  } catch (err) {
    console.error("Error fetching sales:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
