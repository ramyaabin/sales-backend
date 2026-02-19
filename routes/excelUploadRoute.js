import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import fs from "fs";
import Product from "../models/Product.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload-excel", upload.single("file"), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    let allData = [];

    for (const sheetName of workbook.SheetNames) {
      let data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      // ✅ NORMALIZE field names to handle Excel data with spaces/capitals
      data = data.map((row) => ({
        // Use camelCase field names, handle variations
        brand: row.Brand || row.brand || sheetName,

        itemCode: String(
          row["Item Code"] || row.itemCode || row["item code"] || "",
        ),

        modelNumber: String(
          row["Model "] ||
            row["Model"] ||
            row.modelNumber ||
            row["Model no."] ||
            row["model number"] ||
            "",
        ).trim(), // Remove any trailing spaces

        ean: String(row.EAN || row.ean || ""),

        description:
          row["Item Description"] || row.description || row.Description || "",

        rspVat: Number(
          row[" RSP+Vat "] ||
            row["RSP+Vat"] ||
            row.rspVat ||
            row["RSP + VAT"] ||
            0,
        ),
        price: Number(
          row[" RSP+Vat "] ||
            row["RSP+Vat"] ||
            row.rspVat ||
            row["RSP + VAT"] ||
            0,
        ), // ✅ alias so frontend p.price always works

        // Optional fields
        department: row.Department || row.department || "",
        status: row.Status || row.status || "Active",
        cost: Number(row[" Cost "] || row.Cost || row.cost || 0),
        rsp: Number(row[" RSP "] || row.RSP || row.rsp || 0),
        margin: Number(row[" New  Margin "] || row.Margin || row.margin || 0),
      }));

      allData.push(...data);
    }

    // Clear old products and insert new normalized data
    await Product.deleteMany({});
    await Product.insertMany(allData);

    // Cleanup temp file
    fs.unlinkSync(req.file.path);

    console.log(
      `✅ Uploaded ${allData.length} products with normalized field names`,
    );

    res.json({
      message: "Excel uploaded successfully",
      totalRecords: allData.length,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
