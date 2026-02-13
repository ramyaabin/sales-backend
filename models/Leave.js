// models/leaves.js
import mongoose from "mongoose";

const LeaveSchema = new mongoose.Schema(
  {
    salesmanId: { type: String, required: true, index: true, trim: true },
    salesmanName: { type: String, required: true, trim: true },
    fromDate: { type: String, required: true, index: true },
    toDate: { type: String, required: true },
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
    isCritical: { type: Boolean, default: false },
    date: { type: String, index: true },
    leaveType: {
      type: String,
      enum: ["sick", "personal", "vacation", "emergency", "other"],
      default: "other",
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    timestamp: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "leaves" },
);

LeaveSchema.index({ salesmanId: 1, fromDate: 1 }, { unique: true });
LeaveSchema.index({ fromDate: 1, toDate: 1 });
LeaveSchema.index({ status: 1, salesmanId: 1 });
LeaveSchema.index({ date: -1 });

LeaveSchema.pre("save", function (next) {
  this.date = this.fromDate;
  if (this.status === "approved" && !this.approvedAt)
    this.approvedAt = new Date();
  next();
});

LeaveSchema.methods.approve = function (adminUsername) {
  this.status = "approved";
  this.approvedBy = adminUsername;
  this.approvedAt = new Date();
  this.rejectionReason = undefined;
  return this.save();
};

LeaveSchema.methods.reject = function (adminUsername, reason) {
  this.status = "rejected";
  this.approvedBy = adminUsername;
  this.approvedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

LeaveSchema.methods.getDuration = function () {
  const from = new Date(this.fromDate);
  const to = new Date(this.toDate);
  return Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
};

// ==================== STATIC METHODS FOR DASHBOARD ====================
LeaveSchema.statics.getLeavesOnDate = function (date) {
  return this.find({
    fromDate: { $lte: date },
    toDate: { $gte: date },
    status: "approved",
  });
};

LeaveSchema.statics.getLeavesByDateRange = function (startDate, endDate) {
  return this.find({
    $or: [
      { fromDate: { $gte: startDate, $lte: endDate } },
      { toDate: { $gte: startDate, $lte: endDate } },
      { fromDate: { $lte: startDate }, toDate: { $gte: endDate } },
    ],
  }).sort({ fromDate: -1 });
};

LeaveSchema.statics.getSalesmanLeaveBalance = async function (
  salesmanId,
  year,
) {
  const leaves = await this.find({
    salesmanId,
    status: "approved",
    fromDate: { $regex: `^${year}` },
  });
  let totalDays = 0;
  leaves.forEach((l) => {
    totalDays += l.getDuration();
  });
  return totalDays;
};

LeaveSchema.statics.getSalesmenOnLeaveToday = function () {
  const today = new Date().toISOString().split("T")[0];
  return this.find({
    fromDate: { $lte: today },
    toDate: { $gte: today },
    status: "approved",
  }).sort({ salesmanName: 1 });
};

export default mongoose.model("Leave", LeaveSchema);
