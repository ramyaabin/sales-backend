// models/Sale.js
import mongoose from "mongoose";

/**
 * Sale Schema - Permanent Sales Record
 * Supports dashboard analytics, total calculations, and Excel uploads
 */
const SaleSchema = new mongoose.Schema(
  {
    salesmanId: { type: String, required: true, index: true, trim: true },
    salesmanName: { type: String, required: true, trim: true },
    date: { type: String, required: true, index: true },
    timestamp: { type: String, default: () => new Date().toISOString() },
    brand: { type: String, required: true, trim: true, index: true },
    modelNumber: { type: String, trim: true },
    itemCode: { type: String, required: true, trim: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, min: 0 },
    createdAt: Date,
    updatedAt: Date,
  },
  {
    timestamps: true,
    collection: "sales",
  },
);

// ==================== INDEXES ====================
SaleSchema.index({ salesmanId: 1, date: -1 });
SaleSchema.index({ date: -1, salesmanId: 1 });
SaleSchema.index({ brand: 1, date: -1 });
SaleSchema.index({ itemCode: 1, date: -1 });

// ==================== PRE-SAVE HOOK ====================
SaleSchema.pre("save", function (next) {
  if (this.quantity && this.price && !this.totalAmount) {
    this.totalAmount = this.quantity * this.price;
  }
  next();
});

// ==================== STATIC METHODS FOR DASHBOARD ====================

// Get sales by date range
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

// Get monthly sales
SaleSchema.statics.getMonthlySales = function (salesmanId, yearMonth) {
  return this.find({
    salesmanId,
    date: { $regex: `^${yearMonth}` },
  }).sort({ date: -1 });
};

// Get total sales amount
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

// Get brand performance
SaleSchema.statics.getBrandStats = async function (startDate, endDate) {
  const query = {};
  if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
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

// Get salesman performance
SaleSchema.statics.getSalesmanPerformance = async function (
  startDate,
  endDate,
) {
  const query = {};
  if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
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

// ==================== VIRTUALS ====================
SaleSchema.virtual("formattedDate").get(function () {
  return new Date(this.date).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
});

SaleSchema.virtual("formattedAmount").get(function () {
  return `AED ${this.totalAmount?.toLocaleString("en-AE", { minimumFractionDigits: 2 })}`;
});

SaleSchema.virtual("formattedPrice").get(function () {
  return `AED ${this.price?.toLocaleString("en-AE", { minimumFractionDigits: 2 })}`;
});

export default mongoose.model("Sale", SaleSchema);
