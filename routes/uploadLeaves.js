// routes/leaves.js
import express from "express";
import Leave from "../models/Leave.js";

const router = express.Router();

// Add leave
router.post("/", async (req, res) => {
  const leave = await Leave.create(req.body);
  res.json(leave);
});

// Get leaves (admin)
router.get("/", async (req, res) => {
  const leaves = await Leave.find();
  res.json(leaves);
});

// Approve / Reject leave
router.patch("/:id", async (req, res) => {
  const updated = await Leave.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true },
  );
  res.json(updated);
});

export default router;
