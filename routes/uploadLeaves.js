// routes/uploadLeaves.js
import express from "express";
import Leave from "../models/Leave.js";

const router = express.Router();

// Add a leave
router.post("/", async (req, res) => {
  try {
    const leave = await Leave.create(req.body);
    res.status(201).json({ success: true, leave });
  } catch (err) {
    console.error("Error adding leave:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all leaves (optionally filtered)
router.get("/", async (req, res) => {
  try {
    const query = {};
    if (req.query.salesmanId) query.salesmanId = req.query.salesmanId;
    if (req.query.date) query.date = req.query.date;
    const leaves = await Leave.find(query).sort({ timestamp: -1 });
    res.json(leaves);
  } catch (err) {
    console.error("Error fetching leaves:", err);
    res.status(500).json({ error: err.message });
  }
});

// Approve / Reject leave
router.patch("/:id", async (req, res) => {
  try {
    const updated = await Leave.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true },
    );
    res.json(updated);
  } catch (err) {
    console.error("Error updating leave:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
