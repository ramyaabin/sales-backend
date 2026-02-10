import mongoose from "mongoose";
import XLSX from "xlsx";
import dotenv from "dotenv";

dotenv.config();

// 1️⃣ Connect MongoDB
await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

// 2️⃣ Read Excel
const workbook = XLSX.readFile("./excel.xlsx");
const sheetNames = workbook.SheetNames;

// 3️⃣ Flexible schema
const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model("Product", ProductSchema, "products");

let allData = [];

for (const sheetName of sheetNames) {
  const sheet = workbook.Sheets[sheetName];
  let data = XLSX.utils.sheet_to_json(sheet);

  // 🟢 Add brand field from sheet name (VERY IMPORTANT)
  data = data.map((row) => ({
    ...row,
    brand: sheetName,
  }));

  console.log(`📄 ${sheetName}: ${data.length} rows`);
  allData.push(...data);
}

console.log("📊 TOTAL rows from ALL sheets:", allData.length);

// 4️⃣ Insert all sheets
await Product.deleteMany({}); // optional clear
await Product.insertMany(allData);

console.log("✅ ALL Excel sheets inserted successfully");
process.exit();
