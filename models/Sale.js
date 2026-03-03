// models/Sale.js
import mongoose from "mongoose";

const SaleSchema = new mongoose.Schema({
  salesmanId: { type: String, required: true },
  salesmanName: { type: String, required: true },
  date: { type: String, required: true }, // store as YYYY-MM-DD
  location: { type: String, default: "" }, // Location / Outlet Name
  brand: { type: String, required: true },
  itemCode: { type: String, required: true },
  barcode: { type: String, default: "" }, // EAN / Barcode (auto-filled)
  description: { type: String, default: "" }, // Item Description (auto-filled)
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Sale", SaleSchema);
