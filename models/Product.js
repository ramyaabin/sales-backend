import mongoose from "mongoose";

/**
 * Product Schema - Product Catalog Management
 *
 * Stores product information from Excel imports and manual entries.
 * Supports flexible schema for various Excel column formats.
 */
const productSchema = new mongoose.Schema(
  {
    // Core Product Fields (Your Original Fields)
    brand: {
      type: String,
      trim: true,
      index: true, // ✅ Added index for faster searches
    },
    modelNumber: {
      type: Number,
    },
    itemCode: {
      type: Number,
      unique: true, // ✅ Prevent duplicate item codes
      required: true, // ✅ Ensure every product has an item code
      index: true, // ✅ Index for fast lookups
    },
    ean: {
      type: Number,
    },
    description: {
      type: String,
      trim: true,
    },
    rspVat: {
      type: Number,
      min: 0, // ✅ Price cannot be negative
    },

    // ==================== ADDITIONAL FIELDS FOR EXCEL COMPATIBILITY ====================
    // These fields handle various Excel column naming conventions

    // Alternative field names for brand
    Brand: String,

    // Alternative field names for model number
    "Model ": String,
    Model: String,
    modelNo: String,

    // Alternative field names for item code
    "Item Code": String,
    itemcode: String,
    ItemCode: String,

    // Alternative field names for price
    " RSP+Vat ": Number,
    "RSP+Vat": Number,
    price: Number,
    Price: Number,

    // ==================== OPTIONAL INVENTORY FIELDS ====================

    // Stock Management
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Category/Classification
    category: {
      type: String,
      trim: true,
      index: true,
    },

    // Additional Product Info
    supplier: String,
    warranty: String,
    weight: Number,
    dimensions: String,

    // Pricing History
    costPrice: Number,
    profitMargin: Number,
    discount: Number,

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isDiscontinued: {
      type: Boolean,
      default: false,
    },

    // Images/Media
    imageUrl: String,
    images: [String],

    // Metadata
    lastUpdated: Date,
    notes: String,
  },
  {
    strict: false, // ✅ IMPORTANT: Allows flexible schema for Excel imports with unknown columns
    timestamps: true, // ✅ Adds createdAt and updatedAt automatically
  },
);

// ==================== INDEXES FOR PERFORMANCE ====================

// Compound index for searching by brand and item code
productSchema.index({ brand: 1, itemCode: 1 });

// Text index for searching across brand and description
productSchema.index({ brand: "text", description: "text" });

// Index for category filtering
productSchema.index({ category: 1, isActive: 1 });

// Index for stock management
productSchema.index({ stock: 1, isActive: 1 });

// ==================== VIRTUAL PROPERTIES ====================

// Virtual for formatted price
productSchema.virtual("formattedPrice").get(function () {
  const price =
    this.rspVat || this.price || this[" RSP+Vat "] || this["RSP+Vat"] || 0;
  return `AED ${Number(price).toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
});

// Virtual for getting the actual price from various fields
productSchema.virtual("actualPrice").get(function () {
  return this.rspVat || this.price || this[" RSP+Vat "] || this["RSP+Vat"] || 0;
});

// Virtual for getting the actual brand from various fields
productSchema.virtual("actualBrand").get(function () {
  return this.brand || this.Brand || "Unknown";
});

// Virtual for getting the actual model from various fields
productSchema.virtual("actualModel").get(function () {
  return this.modelNumber || this["Model "] || this.Model || this.modelNo || "";
});

// Virtual for getting the actual item code from various fields
productSchema.virtual("actualItemCode").get(function () {
  return (
    this.itemCode || this["Item Code"] || this.itemcode || this.ItemCode || ""
  );
});

// Virtual for stock status
productSchema.virtual("stockStatus").get(function () {
  if (this.isDiscontinued) return "Discontinued";
  if (!this.isActive) return "Inactive";
  if (this.stock === 0) return "Out of Stock";
  if (this.stock < 10) return "Low Stock";
  return "In Stock";
});

// Virtual for stock status color
productSchema.virtual("stockStatusColor").get(function () {
  const status = this.stockStatus;
  const colors = {
    Discontinued: "#757575",
    Inactive: "#9e9e9e",
    "Out of Stock": "#f44336",
    "Low Stock": "#ff9800",
    "In Stock": "#4caf50",
  };
  return colors[status] || "#000000";
});

// ==================== INSTANCE METHODS ====================

// Method to update stock
productSchema.methods.updateStock = function (quantity) {
  this.stock = (this.stock || 0) + quantity;
  this.lastUpdated = new Date();
  return this.save();
};

// Method to deduct stock (for sales)
productSchema.methods.deductStock = function (quantity) {
  if (this.stock < quantity) {
    throw new Error(
      `Insufficient stock. Available: ${this.stock}, Requested: ${quantity}`,
    );
  }
  this.stock -= quantity;
  this.lastUpdated = new Date();
  return this.save();
};

// Method to check if product is available
productSchema.methods.isAvailable = function () {
  return this.isActive && !this.isDiscontinued && this.stock > 0;
};

// ==================== STATIC METHODS ====================

// Search products by keyword
productSchema.statics.searchProducts = function (keyword) {
  const searchRegex = new RegExp(keyword, "i");
  return this.find({
    $or: [
      { brand: searchRegex },
      { Brand: searchRegex },
      { description: searchRegex },
      { itemCode: keyword },
      { "Item Code": keyword },
    ],
    isActive: true,
  }).sort({ brand: 1 });
};

// Get products by brand
productSchema.statics.getByBrand = function (brand) {
  return this.find({
    $or: [{ brand }, { Brand: brand }],
    isActive: true,
  }).sort({ itemCode: 1 });
};

// Get products by category
productSchema.statics.getByCategory = function (category) {
  return this.find({ category, isActive: true }).sort({ brand: 1 });
};

// Get low stock products
productSchema.statics.getLowStock = function (threshold = 10) {
  return this.find({
    stock: { $lt: threshold, $gt: 0 },
    isActive: true,
    isDiscontinued: false,
  }).sort({ stock: 1 });
};

// Get out of stock products
productSchema.statics.getOutOfStock = function () {
  return this.find({
    stock: 0,
    isActive: true,
    isDiscontinued: false,
  }).sort({ brand: 1 });
};

// ==================== PRE-SAVE HOOKS ====================

// Update lastUpdated before saving
productSchema.pre("save", function (next) {
  this.lastUpdated = new Date();
  next();
});

// Normalize data before saving (handle different Excel column formats)
productSchema.pre("save", function (next) {
  // Ensure brand field is populated from alternatives
  if (!this.brand && this.Brand) {
    this.brand = this.Brand;
  }

  // Ensure itemCode is a number
  if (typeof this.itemCode === "string") {
    this.itemCode = parseInt(this.itemCode, 10);
  }

  // Ensure rspVat is populated from alternatives
  if (!this.rspVat) {
    this.rspVat = this.price || this[" RSP+Vat "] || this["RSP+Vat"];
  }

  next();
});

// ==================== NOTES ====================
/*
 * PRODUCT MANAGEMENT FEATURES:
 *
 * EXCEL IMPORT COMPATIBILITY:
 * - strict: false allows any Excel column to be imported
 * - Multiple field variations handle different Excel formats
 * - Virtual properties normalize data access
 *
 * STOCK MANAGEMENT:
 * - Track stock levels
 * - Automatic stock status calculation
 * - Low stock alerts
 * - Out of stock tracking
 *
 * SEARCH FEATURES:
 * - Full-text search on brand and description
 * - Search by item code
 * - Filter by category
 * - Filter by stock status
 *
 * PRICING:
 * - Support multiple price field names
 * - Cost price and profit margin tracking
 * - Discount management
 *
 * USAGE EXAMPLES:
 *
 * // Create product
 * const product = new Product({
 *   brand: "Samsung",
 *   itemCode: 12345,
 *   rspVat: 1500,
 *   stock: 50
 * });
 * await product.save();
 *
 * // Search products
 * const results = await Product.searchProducts("Samsung");
 *
 * // Get low stock
 * const lowStock = await Product.getLowStock(10);
 *
 * // Update stock after sale
 * await product.deductStock(5);
 */

// 👇 FORCE collection name to "products" (matches your existing data)
export default mongoose.model("Product", productSchema, "products");
