// models/Leave.js
import mongoose from "mongoose";

const LeaveSchema = new mongoose.Schema({
  salesmanId: { type: String, required: true },
  salesmanName: { type: String, required: true },

  fromDate: { type: String, required: true }, // YYYY-MM-DD
  toDate: { type: String, required: true },

  reason: { type: String },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },

  isCritical: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Leave", LeaveSchema);
