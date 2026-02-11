import mongoose from "mongoose";

/**
 * Leave Schema - Leave Application Management
 *
 * YOUR ORIGINAL SCHEMA + Enhanced Features:
 * - Single-day and multi-day leave support
 * - Status tracking (pending, approved, rejected)
 * - Critical/emergency leave flagging
 * - Date range queries and analytics
 */
const LeaveSchema = new mongoose.Schema(
  {
    // ==================== YOUR ORIGINAL FIELDS ====================

    salesmanId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    salesmanName: {
      type: String,
      required: true,
      trim: true,
    },

    fromDate: {
      type: String, // YYYY-MM-DD format
      required: true,
      index: true,
    },

    toDate: {
      type: String, // YYYY-MM-DD format
      required: true,
    },

    reason: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved", // Changed from "pending" to "approved" for auto-approval
      index: true,
    },

    isCritical: {
      type: Boolean,
      default: false,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    // ==================== ENHANCED FIELDS ====================

    // Compatibility field for single-day queries (auto-populated)
    date: {
      type: String, // YYYY-MM-DD - will be set to fromDate
      index: true,
    },

    // Leave Type Classification
    leaveType: {
      type: String,
      enum: ["sick", "personal", "vacation", "emergency", "other"],
      default: "other",
    },

    // Approval Information
    approvedBy: {
      type: String, // Admin username who approved/rejected
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },

    // Metadata
    timestamp: {
      type: String,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    collection: "leaves",
  },
);

// ==================== INDEXES ====================

// Unique constraint: One leave application per salesman per date
// This prevents duplicate leave applications for the same starting date
LeaveSchema.index({ salesmanId: 1, fromDate: 1 }, { unique: true });

// Compound index for date range queries
LeaveSchema.index({ fromDate: 1, toDate: 1 });

// Index for status filtering
LeaveSchema.index({ status: 1, salesmanId: 1 });

// Index for single-day date queries (backward compatibility)
LeaveSchema.index({ date: -1 });

// ==================== PRE-SAVE HOOKS ====================

// Auto-populate 'date' field from 'fromDate' for backward compatibility
LeaveSchema.pre("save", function (next) {
  // Always set date = fromDate for compatibility with existing queries
  this.date = this.fromDate;
  next();
});

// Auto-set approval timestamp when status changes to approved
LeaveSchema.pre("save", function (next) {
  if (this.status === "approved" && !this.approvedAt) {
    this.approvedAt = new Date();
  }
  next();
});

// ==================== INSTANCE METHODS ====================

// Approve leave application
LeaveSchema.methods.approve = function (adminUsername) {
  this.status = "approved";
  this.approvedBy = adminUsername;
  this.approvedAt = new Date();
  this.rejectionReason = undefined;
  return this.save();
};

// Reject leave application
LeaveSchema.methods.reject = function (adminUsername, reason) {
  this.status = "rejected";
  this.approvedBy = adminUsername;
  this.rejectionReason = reason;
  this.approvedAt = new Date();
  return this.save();
};

// Check if leave is active on a specific date
LeaveSchema.methods.isActiveOn = function (dateString) {
  return dateString >= this.fromDate && dateString <= this.toDate;
};

// Calculate duration in days
LeaveSchema.methods.getDuration = function () {
  const from = new Date(this.fromDate);
  const to = new Date(this.toDate);
  const diffTime = Math.abs(to - from);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days
  return diffDays;
};

// Check if leave is a single day
LeaveSchema.methods.isSingleDay = function () {
  return this.fromDate === this.toDate;
};

// ==================== STATIC METHODS ====================

// Get leaves for a specific date (backward compatible)
LeaveSchema.statics.getLeavesOnDate = function (date) {
  return this.find({
    fromDate: { $lte: date },
    toDate: { $gte: date },
    status: "approved",
  });
};

// Get leaves for a date range
LeaveSchema.statics.getLeavesByDateRange = function (startDate, endDate) {
  return this.find({
    $or: [
      { fromDate: { $gte: startDate, $lte: endDate } },
      { toDate: { $gte: startDate, $lte: endDate } },
      {
        fromDate: { $lte: startDate },
        toDate: { $gte: endDate },
      },
    ],
  }).sort({ fromDate: -1 });
};

// Get leaves for a specific month (backward compatible)
LeaveSchema.statics.getMonthlyLeaves = function (yearMonth) {
  return this.find({
    $or: [
      { fromDate: { $regex: `^${yearMonth}` } },
      { toDate: { $regex: `^${yearMonth}` } },
      { date: { $regex: `^${yearMonth}` } }, // Backward compatibility
    ],
  }).sort({ fromDate: -1 });
};

// Get pending leave applications
LeaveSchema.statics.getPendingLeaves = function () {
  return this.find({ status: "pending" }).sort({ createdAt: -1 });
};

// Get salesman's total leave days taken
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
  leaves.forEach((leave) => {
    const from = new Date(leave.fromDate);
    const to = new Date(leave.toDate);
    const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
    totalDays += days;
  });

  return totalDays;
};

// Get all salesmen on leave today
LeaveSchema.statics.getSalesmenOnLeaveToday = function () {
  const today = new Date().toISOString().split("T")[0];
  return this.find({
    fromDate: { $lte: today },
    toDate: { $gte: today },
    status: "approved",
  }).sort({ salesmanName: 1 });
};

// Get critical/emergency leaves
LeaveSchema.statics.getCriticalLeaves = function (startDate, endDate) {
  const query = { isCritical: true };
  if (startDate && endDate) {
    query.fromDate = { $gte: startDate, $lte: endDate };
  }
  return this.find(query).sort({ fromDate: -1 });
};

// ==================== VIRTUAL PROPERTIES ====================

// Virtual for formatted date range
LeaveSchema.virtual("dateRange").get(function () {
  if (this.fromDate === this.toDate) {
    return new Date(this.fromDate).toLocaleDateString("en-AE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  const from = new Date(this.fromDate).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
  });
  const to = new Date(this.toDate).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${from} - ${to}`;
});

// Virtual for status badge color
LeaveSchema.virtual("statusColor").get(function () {
  const colors = {
    pending: "#ff9800", // Orange
    approved: "#4caf50", // Green
    rejected: "#f44336", // Red
  };
  return colors[this.status] || "#757575";
});

// Virtual for duration display
LeaveSchema.virtual("durationDisplay").get(function () {
  const days = this.getDuration();
  return days === 1 ? "1 day" : `${days} days`;
});

// Virtual for leave type display
LeaveSchema.virtual("leaveTypeDisplay").get(function () {
  const types = {
    sick: "Sick Leave",
    personal: "Personal Leave",
    vacation: "Vacation",
    emergency: "Emergency",
    other: "Other",
  };
  return types[this.leaveType] || this.leaveType;
});

// ==================== USAGE NOTES ====================
/*
 * LEAVE MANAGEMENT FEATURES:
 *
 * SINGLE DAY LEAVE:
 * const leave = new Leave({
 *   salesmanId: "SM001",
 *   salesmanName: "John Doe",
 *   fromDate: "2024-02-15",
 *   toDate: "2024-02-15",
 *   reason: "Medical appointment",
 *   status: "approved"
 * });
 *
 * MULTI-DAY LEAVE:
 * const leave = new Leave({
 *   salesmanId: "SM001",
 *   salesmanName: "John Doe",
 *   fromDate: "2024-02-15",
 *   toDate: "2024-02-20",
 *   reason: "Vacation",
 *   leaveType: "vacation",
 *   status: "pending"
 * });
 *
 * EMERGENCY LEAVE:
 * const leave = new Leave({
 *   salesmanId: "SM001",
 *   salesmanName: "John Doe",
 *   fromDate: "2024-02-15",
 *   toDate: "2024-02-15",
 *   reason: "Family emergency",
 *   leaveType: "emergency",
 *   isCritical: true,
 *   status: "approved"
 * });
 *
 * BACKWARD COMPATIBILITY:
 * - The 'date' field is auto-populated from 'fromDate'
 * - Existing queries using 'date' will continue to work
 * - Queries like { date: "2024-02-15" } will match leaves
 *
 * APPROVAL WORKFLOW:
 * - Set status: "pending" for manual approval
 * - Set status: "approved" for auto-approval
 * - Admin can approve: leave.approve("admin_username")
 * - Admin can reject: leave.reject("admin_username", "reason")
 *
 * QUERIES:
 * - Today's leaves: Leave.getSalesmenOnLeaveToday()
 * - Monthly leaves: Leave.getMonthlyLeaves("2024-02")
 * - Pending leaves: Leave.getPendingLeaves()
 * - Date range: Leave.getLeavesByDateRange("2024-02-01", "2024-02-29")
 */

export default mongoose.model("Leave", LeaveSchema);
