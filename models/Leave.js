// models/Leave.js
import mongoose from "mongoose";

const LeaveSchema = new mongoose.Schema({
  salesmanId: { type: String, required: true },
  salesmanName: { type: String, required: true },
  date: { type: String, required: true }, // store as YYYY-MM-DD
  reason: { type: String, required: true },
  status: { type: String, default: "Pending" }, // Pending / Approved / Rejected
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Leave", LeaveSchema);
