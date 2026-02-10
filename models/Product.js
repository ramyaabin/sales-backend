import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    brand: String,
    modelNumber: Number,
    itemCode: Number,
    ean: Number,
    description: String,
    rspVat: Number,
  },
  {
    strict: true,
  },
);

// 👇 FORCE collection name
export default mongoose.model("Product", productSchema, "products");
