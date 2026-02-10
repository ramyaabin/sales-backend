import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Sale from "../models/Sale.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload-sales", upload.single("file"), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const sales = rows.map((r) => ({
      salesmanName: r.Salesman,
      date: r.Date,
      brand: r.Brand,
      modelNumber: r["Model No"],
      itemCode: r["Item Code"],
      quantity: Number(r.Quantity),
      rspVat: Number(r["RSP+VAT"]),
      totalAmount: Number(r["Total Amount"]),
    }));

    await Sale.deleteMany(); // optional
    await Sale.insertMany(sales);

    res.json({ success: true, count: sales.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
