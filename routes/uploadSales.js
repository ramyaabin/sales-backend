import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Sale from "../models/Sale.js";

const router = express.Router();

// Configure Multer for file uploads
const upload = multer({ dest: "uploads/" });

// ==================== UPLOAD SALES FROM EXCEL ====================
router.post("/upload-sales", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Read Excel workbook
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({ error: "Uploaded file is empty" });
    }

    // Map Excel rows to Sale schema
    const sales = rows.map((r) => {
      const quantity = Number(r.Quantity) || 1;
      const price = Number(r.Price) || Number(r["RSP+VAT"]) || 0;
      const totalAmount = Number(r["Total Amount"]) || quantity * price;

      return {
        salesmanId: r.SalesmanID || "unknown", // Must exist in schema
        salesmanName: r.Salesman || "Unknown",
        date: r.Date, // Ensure format YYYY-MM-DD
        brand: r.Brand || "",
        modelNumber: r["Model No"] || "",
        itemCode: r["Item Code"] || "",
        quantity,
        price,
        totalAmount,
        timestamp: new Date().toISOString(),
      };
    });

    // Optional: delete all previous sales
    // await Sale.deleteMany();

    // Insert mapped sales into database
    await Sale.insertMany(sales);

    res.status(200).json({
      success: true,
      message: `${sales.length} sales records uploaded successfully`,
      count: sales.length,
    });
  } catch (err) {
    console.error("Upload sales error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
