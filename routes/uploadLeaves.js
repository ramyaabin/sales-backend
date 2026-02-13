// routes/uploadLeaves.js
import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Leave from "../models/leaves.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ==================== UPLOAD LEAVES FROM EXCEL ====================
router.post("/upload-leaves", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length)
      return res.status(400).json({ error: "Excel sheet is empty" });

    const leaves = rows.map((r) => {
      const fromDate = r.FromDate || r.fromDate;
      const toDate = r.ToDate || r.toDate || fromDate;
      const leaveType = r.LeaveType?.toLowerCase() || "other";
      const status = r.Status?.toLowerCase() || "approved";
      const isCritical = r.IsCritical === "yes" || r.IsCritical === true;

      return {
        salesmanId: r.SalesmanID || "unknown",
        salesmanName: r.Salesman || "Unknown",
        fromDate,
        toDate,
        date: fromDate,
        reason: r.Reason || "",
        leaveType,
        status,
        isCritical,
        timestamp: new Date().toISOString(),
      };
    });

    // Optional: delete previous leaves if you want a fresh upload
    // await Leave.deleteMany();

    await Leave.insertMany(leaves);

    res.status(200).json({
      success: true,
      message: `${leaves.length} leave records uploaded successfully`,
      count: leaves.length,
    });
  } catch (err) {
    console.error("Error uploading leaves:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
