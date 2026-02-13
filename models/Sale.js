import mongoose from "mongoose";

/**
 * Sale Schema - Permanent Sales Record Storage
 *
 * Stores all sales records permanently in MongoDB.
 * Designed for long-term reporting, analytics, and auditing.
 */
const SaleSchema = new mongoose.Schema(
  {
    // Salesman Information
    salesmanId: {
      type: String,
      required: true,
      trim: true,
      index: true, // fast queries by salesman
    },
    salesmanName: {
      type: String,
      required: true,
      trim: true,
    },

    // Sale Date
    date: {
      type: String, // format: YYYY-MM-DD
      required: true,
      index: true,
    },
    timestamp: {
      type: String,
      default: () => new Date().toISOString(),
    },

    // Product Information
    brand: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    modelNumber: {
      type: String,
      trim: true,
    },
    itemCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Sale Details
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
    },

    // Metadata
    createdAt: Date,
    updatedAt: Date,
  },
  {
    timestamps: true,
    collection: "sales",
  },
);

// ==================== PRE-SAVE HOOK ====================
// Calculate totalAmount if not already set
SaleSchema.pre("save", function (next) {
  if (this.quantity && this.price && !this.totalAmount) {
    this.totalAmount = this.quantity * this.price;
  }
  next();
});

// ==================== INDEXES ====================
SaleSchema.index({ salesmanId: 1, date: -1 });
SaleSchema.index({ date: -1, salesmanId: 1 });
SaleSchema.index({ brand: 1, date: -1 });
SaleSchema.index({ itemCode: 1, date: -1 });

// ==================== STATIC METHODS ====================

// Get sales by salesman and optional date range
SaleSchema.statics.getSalesByDateRange = function (
  salesmanId,
  startDate,
  endDate,
) {
  const query = { salesmanId };
  if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
  else if (startDate) query.date = { $gte: startDate };
  else if (endDate) query.date = { $lte: endDate };
  return this.find(query).sort({ date: -1 });
};

// Get monthly sales for a salesman (YYYY-MM)
SaleSchema.statics.getMonthlySales = function (salesmanId, yearMonth) {
  return this.find({
    salesmanId,
    date: { $regex: `^${yearMonth}` },
  }).sort({ date: -1 });
};

// Get sales by brand
SaleSchema.statics.getSalesByBrand = function (brand, startDate, endDate) {
  const query = { brand };
  if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
  return this.find(query).sort({ date: -1 });
};

// Get total sales amount for a salesman
SaleSchema.statics.getTotalSales = async function (
  salesmanId,
  startDate,
  endDate,
) {
  const query = { salesmanId };
  if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };

  const result = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { total: 0, count: 0 };
};

// ==================== VIRTUAL PROPERTIES ====================

// Formatted date
SaleSchema.virtual("formattedDate").get(function () {
  return new Date(this.date).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
});

// Formatted total amount
SaleSchema.virtual("formattedAmount").get(function () {
  return `AED ${this.totalAmount.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
});

// Formatted price per unit
SaleSchema.virtual("formattedPrice").get(function () {
  return `AED ${this.price.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
});

export default mongoose.model("Sale", SaleSchema);
