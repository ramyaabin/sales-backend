import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import User from "../models/User.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload-users", upload.single("file"), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let inserted = 0;
    let skipped = 0;

    for (const r of rows) {
      if (!r.Username || !r.Password || !r.Name || !r.Role) {
        skipped++;
        continue;
      }

      const role = r.Role.toLowerCase();

      // Check duplicate username
      const exists = await User.findOne({ username: r.Username });
      if (exists) {
        skipped++;
        continue;
      }

      await User.create({
        username: r.Username,
        password: r.Password,
        name: r.Name,
        role,
        salesmanId: role === "salesman" ? r.SalesmanId : undefined,
      });

      inserted++;
    }

    res.json({
      success: true,
      inserted,
      skipped,
      totalRows: rows.length,
    });
  } catch (err) {
    console.error("Upload users error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
