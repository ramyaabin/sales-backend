import mongoose from "mongoose";

/**
 * Sale Schema - Permanent Sales Record Storage
 *
 * This schema stores all sales records PERMANENTLY in MongoDB.
 * Records are NEVER automatically deleted - they accumulate indefinitely.
 * Designed for long-term historical reporting and audit trails.
 */
const SaleSchema = new mongoose.Schema(
  {
    // Salesman Information
    salesmanId: {
      type: String,
      required: true,
      index: true, // ✅ Index for faster queries by salesman
      trim: true,
    },
    salesmanName: {
      type: String,
      required: true, // Made required to ensure data integrity
      trim: true,
    },

    // Sale Date and Time
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      index: true, // ✅ Index for date-based queries
    },
    timestamp: {
      type: String, // ISO timestamp for exact time
      default: () => new Date().toISOString(),
    },

    // Product Information
    brand: {
      type: String,
      required: true, // Made required for data integrity
      trim: true,
      index: true, // ✅ Index for brand-based reports
    },
    modelNumber: {
      type: String,
      trim: true,
    },
    itemCode: {
      type: String,
      required: true, // Made required for data integrity
      trim: true,
      index: true, // ✅ Index for product lookups
    },

    // Sale Details
    quantity: {
      type: Number,
      required: true,
      min: 1, // Must be at least 1
    },
    price: {
      type: Number, // Price per unit in AED
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number, // Total = quantity × price
      min: 0,
    },

    // Metadata for auditing
    createdAt: Date, // Auto-added by timestamps
    updatedAt: Date, // Auto-added by timestamps
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
    collection: "sales", // Explicit collection name
  },
);

// ==================== INDEXES FOR PERFORMANCE ====================

// Compound index for common queries: salesman's sales by date
SaleSchema.index({ salesmanId: 1, date: -1 });

// Compound index for date range queries
SaleSchema.index({ date: -1, salesmanId: 1 });

// Index for brand analysis
SaleSchema.index({ brand: 1, date: -1 });

// Index for monthly reports
SaleSchema.index({ date: -1 });

// Compound index for item tracking
SaleSchema.index({ itemCode: 1, date: -1 });

// ==================== SCHEMA METHODS ====================

// Calculate total amount before saving (if not already set)
SaleSchema.pre("save", function (next) {
  if (this.quantity && this.price && !this.totalAmount) {
    this.totalAmount = this.quantity * this.price;
  }
  next();
});

// Static method to get sales by date range
SaleSchema.statics.getSalesByDateRange = function (
  salesmanId,
  startDate,
  endDate,
) {
  const query = { salesmanId };
  if (startDate && endDate) {
    query.date = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    query.date = { $gte: startDate };
  } else if (endDate) {
    query.date = { $lte: endDate };
  }
  return this.find(query).sort({ date: -1 });
};

// Static method to get monthly sales
SaleSchema.statics.getMonthlySales = function (salesmanId, yearMonth) {
  return this.find({
    salesmanId,
    date: { $regex: `^${yearMonth}` },
  }).sort({ date: -1 });
};

// Static method to get sales by brand
SaleSchema.statics.getSalesByBrand = function (brand, startDate, endDate) {
  const query = { brand };
  if (startDate && endDate) {
    query.date = { $gte: startDate, $lte: endDate };
  }
  return this.find(query).sort({ date: -1 });
};

// Static method to get total sales amount
SaleSchema.statics.getTotalSales = async function (
  salesmanId,
  startDate,
  endDate,
) {
  const query = { salesmanId };
  if (startDate && endDate) {
    query.date = { $gte: startDate, $lte: endDate };
  }

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

// Static method to get brand performance statistics
SaleSchema.statics.getBrandStats = async function (startDate, endDate) {
  const query = {};
  if (startDate && endDate) {
    query.date = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$brand",
        totalSales: { $sum: "$totalAmount" },
        totalQuantity: { $sum: "$quantity" },
        transactionCount: { $sum: 1 },
      },
    },
    { $sort: { totalSales: -1 } },
  ]);
};

// Static method to get salesman performance
SaleSchema.statics.getSalesmanPerformance = async function (
  startDate,
  endDate,
) {
  const query = {};
  if (startDate && endDate) {
    query.date = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$salesmanId",
        salesmanName: { $first: "$salesmanName" },
        totalSales: { $sum: "$totalAmount" },
        totalTransactions: { $sum: 1 },
      },
    },
    { $sort: { totalSales: -1 } },
  ]);
};

// ==================== VIRTUAL PROPERTIES ====================

// Virtual for formatted date
SaleSchema.virtual("formattedDate").get(function () {
  return new Date(this.date).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
});

// Virtual for formatted amount in AED
SaleSchema.virtual("formattedAmount").get(function () {
  return `AED ${this.totalAmount.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
});

// Virtual for formatted price
SaleSchema.virtual("formattedPrice").get(function () {
  return `AED ${this.price.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
});

// ==================== IMPORTANT NOTES ====================
/*
 * PERMANENT STORAGE:
 * - This collection stores ALL sales records indefinitely
 * - No automatic deletion is implemented
 * - Records accumulate over years for historical reporting
 *
 * MAINTENANCE:
 * - Ensure regular database backups
 * - Monitor collection size over time
 * - Consider archiving very old records (5+ years) if needed
 *
 * PERFORMANCE:
 * - Indexes ensure fast queries even with millions of records
 * - Date-based indexes support efficient reporting
 * - Compound indexes optimize common query patterns
 *
 * DATA INTEGRITY:
 * - Required fields: salesmanId, salesmanName, date, brand, itemCode, quantity, price
 * - Auto-calculation of totalAmount if not provided
 * - Timestamps track creation and modification
 */

export default mongoose.model("Sale", SaleSchema);
