// routes/uploadSales.js
import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Sale from "../models/Sale.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload-sales", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    // Map Excel rows to Sale model
    const sales = rows.map((r) => ({
      salesmanId: r["Salesman ID"] || r.Salesman,
      salesmanName: r.Salesman,
      date: r.Date,
      brand: r.Brand,
      modelNumber: r["Model No"],
      itemCode: r["Item Code"],
      quantity: Number(r.Quantity),
      price: Number(r["RSP+VAT"]),
      totalAmount: Number(r["Total Amount"]),
    }));

    // Insert without removing existing sales
    await Sale.insertMany(sales, { ordered: false });

    res.json({ success: true, count: sales.length });
  } catch (err) {
    console.error("Upload sales error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
