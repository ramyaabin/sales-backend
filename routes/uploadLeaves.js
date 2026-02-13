// routes/uploadLeaves.js
import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Leave from "../models/Leave.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload-leaves", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const leaves = rows.map((r) => ({
      salesmanId: r["Salesman ID"] || r.Salesman,
      salesmanName: r.Salesman,
      fromDate: r["From Date"] || r.Date,
      toDate: r["To Date"] || r.Date,
      reason: r.Reason,
      status: r.Status ? r.Status.toLowerCase() : "approved",
      leaveType: r.LeaveType ? r.LeaveType.toLowerCase() : "other",
      isCritical: r.IsCritical === "true" || r.IsCritical === true,
    }));

    await Leave.insertMany(leaves, { ordered: false });

    res.json({ success: true, count: leaves.length });
  } catch (err) {
    console.error("Upload leaves error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
