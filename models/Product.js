import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    // ── Core normalized fields (what excelUploadRoute stores) ──────────────
    brand: { type: String, trim: true, index: true },
    modelNumber: { type: String, trim: true }, // ✅ String — alphanumeric
    itemCode: {
      type: String, // ✅ String — never parseInt
      unique: true,
      sparse: true, // ✅ Allows many docs with empty/null itemCode (no E11000)
      trim: true,
      index: true,
    },
    ean: { type: String, trim: true }, // ✅ String — leading zeros
    description: { type: String, trim: true },
    price: { type: Number, min: 0, default: 0 }, // primary price field
    rspVat: { type: Number, min: 0, default: 0 }, // alias kept for compat

    // ── Exact Excel column names your file actually uses ───────────────────
    // (strict:false stores them anyway, but declaring them avoids cast errors)
    Brand: String,
    ModelNo: String, // ✅ "ModelNo." column
    Barcode: String, // ✅ "Barcode" column
    Description: String, // ✅ "Description" column
    "RSP+VAT": Number, // ✅ "RSP+VAT" column

    // ── Legacy / alternative column name variants ──────────────────────────
    "Model ": String,
    Model: String,
    modelNo: String,
    "Item Code": String,
    itemcode: String,
    ItemCode: String,
    " RSP+Vat ": Number,
    "RSP+Vat": Number,
    Price: Number,

    // ── Optional fields ────────────────────────────────────────────────────
    department: { type: String, default: "" },
    status: { type: String, default: "Active" },
    cost: { type: Number, default: 0 },
    rsp: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    stock: { type: Number, default: 0, min: 0 },
    category: { type: String, trim: true, index: true },
    isActive: { type: Boolean, default: true },
    isDiscontinued: { type: Boolean, default: false },
    imageUrl: String,
    images: [String],
    lastUpdated: Date,
    notes: String,
  },
  {
    strict: false, // ✅ Any extra Excel column is stored as-is
    timestamps: true, // adds createdAt / updatedAt
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────
productSchema.index({ brand: 1, itemCode: 1 });
productSchema.index({ brand: "text", description: "text" });
productSchema.index({ category: 1, isActive: 1 });

// ── Virtual: resolved price (checks every possible field name) ─────────────
productSchema.virtual("actualPrice").get(function () {
  return (
    (this["RSP+VAT"] > 0 ? this["RSP+VAT"] : null) ||
    (this["RSP+Vat"] > 0 ? this["RSP+Vat"] : null) ||
    (this[" RSP+Vat "] > 0 ? this[" RSP+Vat "] : null) ||
    (this.rspVat > 0 ? this.rspVat : null) ||
    (this.price > 0 ? this.price : null) ||
    (this.Price > 0 ? this.Price : null) ||
    0
  );
});

productSchema.virtual("actualBrand").get(function () {
  return this.brand || this.Brand || "Unknown";
});

productSchema.virtual("actualModel").get(function () {
  return (
    this.modelNumber ||
    this.ModelNo ||
    this["ModelNo."] ||
    this["Model "] ||
    this.Model ||
    this.modelNo ||
    ""
  );
});

productSchema.virtual("actualItemCode").get(function () {
  return (
    this.itemCode || this["Item Code"] || this.itemcode || this.ItemCode || ""
  );
});

productSchema.virtual("actualEan").get(function () {
  return this.ean || this.EAN || this.Barcode || this.barcode || "";
});

productSchema.virtual("stockStatus").get(function () {
  if (this.isDiscontinued) return "Discontinued";
  if (!this.isActive) return "Inactive";
  if (this.stock === 0) return "Out of Stock";
  if (this.stock < 10) return "Low Stock";
  return "In Stock";
});

// ── Pre-save hook ──────────────────────────────────────────────────────────
productSchema.pre("save", function (next) {
  this.lastUpdated = new Date();

  // Sync brand from capitalized fallback
  if (!this.brand && this.Brand) this.brand = this.Brand.trim();

  // ✅ NEVER parseInt — keep itemCode as a plain string
  if (this.itemCode) this.itemCode = String(this.itemCode).trim();

  // Sync price / rspVat from whichever field has a value
  const resolvedPrice =
    (this["RSP+VAT"] > 0 ? this["RSP+VAT"] : null) ||
    (this["RSP+Vat"] > 0 ? this["RSP+Vat"] : null) ||
    (this[" RSP+Vat "] > 0 ? this[" RSP+Vat "] : null) ||
    (this.rspVat > 0 ? this.rspVat : null) ||
    (this.price > 0 ? this.price : null) ||
    0;

  if (!this.price || this.price === 0) this.price = resolvedPrice;
  if (!this.rspVat || this.rspVat === 0) this.rspVat = resolvedPrice;

  next();
});

// ── Static helpers ─────────────────────────────────────────────────────────
productSchema.statics.searchProducts = function (keyword) {
  const rx = new RegExp(keyword, "i");
  return this.find({
    $or: [
      { brand: rx },
      { Brand: rx },
      { description: rx },
      { Description: rx },
      { modelNumber: rx },
      { ModelNo: rx },
      { itemCode: rx },
    ],
  }).sort({ brand: 1 });
};

// 👇 Force collection name to "products"
export default mongoose.model("Product", productSchema, "products");
