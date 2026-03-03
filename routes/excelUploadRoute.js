import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import fs from "fs";
import Product from "../models/Product.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/**
 * Case-insensitive, whitespace-tolerant column finder.
 * Tries every key in the row object so mismatched Excel headers
 * (extra spaces, different capitalisation, underscores) never cause data loss.
 */
const col = (row, ...candidates) => {
  // Build a normalised lookup map once per row call
  const keys = Object.keys(row);
  const normalise = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[\s_\-\.]+/g, "");

  for (const candidate of candidates) {
    const norm = normalise(candidate);
    const match = keys.find((k) => normalise(k) === norm);
    if (
      match !== undefined &&
      row[match] !== undefined &&
      row[match] !== null &&
      row[match] !== ""
    ) {
      return row[match];
    }
  }
  return undefined;
};

router.post("/upload-excel", upload.single("file"), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    let allData = [];

    for (const sheetName of workbook.SheetNames) {
      let data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      // Log actual column names from first row so we can debug future mismatches
      if (data.length > 0) {
        console.log(`📋 Sheet "${sheetName}" columns:`, Object.keys(data[0]));
      }

      data = data.map((row) => {
        // ── Item Code ──────────────────────────────────────────────────────
        const rawItemCode = col(
          row,
          "Item Code",
          "item code",
          "ItemCode",
          "ITEM CODE",
          "Item_Code",
          "item_code",
          "Product Code",
          "product code",
          "SKU",
          "sku",
          "Code",
          "code",
        );

        // ── Model Number ───────────────────────────────────────────────────
        const rawModel = col(
          row,
          "ModelNo.",
          "ModelNo",
          "Model No.",
          "Model No", // ← exact Excel headers first
          "Model ",
          "Model",
          "model",
          "MODEL",
          "model number",
          "Model Number",
          "modelNumber",
          "Model_No",
        );

        // ── EAN / Barcode ──────────────────────────────────────────────────
        const rawEan = col(
          row,
          "Barcode",
          "barcode",
          "BARCODE",
          "Bar Code", // ← exact Excel header first
          "EAN",
          "ean",
          "Ean",
          "EAN Code",
          "ean code",
        );

        // ── Price (RSP+VAT) ────────────────────────────────────────────────
        const rawPrice = col(
          row,
          "RSP+VAT",
          "RSP+Vat",
          " RSP+Vat ",
          "RSP + VAT", // ← exact Excel headers first
          "RSP+Vat ",
          "rspVat",
          "rspvat",
          "RSPVAT",
          "RSP_VAT",
          "RSP VAT",
          "Price",
          "price",
          "Selling Price",
          "selling price",
          "Retail Price",
        );

        // ── Brand ──────────────────────────────────────────────────────────
        const rawBrand = col(row, "Brand", "brand", "BRAND", "Make", "make");

        // ── Description ────────────────────────────────────────────────────
        const rawDesc = col(
          row,
          "Description",
          "Item Description",
          "item description", // ← exact Excel headers first
          "description",
          "DESCRIPTION",
          "Product Name",
          "Product Description",
          "Desc",
        );

        // ── Optional pricing fields ────────────────────────────────────────
        const rawCost = col(
          row,
          " Cost ",
          "Cost",
          "cost",
          "COST",
          "Cost Price",
        );
        const rawRsp = col(row, " RSP ", "RSP", "rsp", "Retail");
        const rawMarg = col(
          row,
          " New  Margin ",
          "Margin",
          "margin",
          "MARGIN",
          "New Margin",
        );
        const rawDept = col(row, "Department", "department", "Dept");
        const rawStat = col(row, "Status", "status");

        return {
          brand: String(rawBrand || sheetName).trim(),
          itemCode: rawItemCode !== undefined ? String(rawItemCode).trim() : "",
          modelNumber: rawModel !== undefined ? String(rawModel).trim() : "",
          ean: rawEan !== undefined ? String(rawEan).trim() : "",
          description: rawDesc !== undefined ? String(rawDesc).trim() : "",
          rspVat: Number(rawPrice) || 0,
          price: Number(rawPrice) || 0, // alias — frontend always reads p.price
          cost: Number(rawCost) || 0,
          rsp: Number(rawRsp) || 0,
          margin: Number(rawMarg) || 0,
          department: rawDept ? String(rawDept) : "",
          status: rawStat ? String(rawStat) : "Active",
        };
      });

      allData.push(...data);
    }

    // Log a sample for debugging
    if (allData.length > 0) {
      console.log("📦 Sample normalised product:", allData[0]);
    }

    // Clear old products and insert new normalised data
    await Product.deleteMany({});
    await Product.insertMany(allData, { ordered: false }); // ordered:false — skip bad docs, continue

    fs.unlinkSync(req.file.path);

    console.log(
      `✅ Uploaded ${allData.length} products with normalised field names`,
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
