// models/Leave.js
import mongoose from "mongoose";

const LeaveSchema = new mongoose.Schema({
  salesmanId: { type: String, required: true },
  salesmanName: { type: String, required: true },
  date: { type: String, required: true }, // store as YYYY-MM-DD
  reason: { type: String, required: true },
  status: { type: String, default: "Pending" }, // Pending / Approved / Rejected
  adminRemark: { type: String, default: "" }, // ✅ reason when rejected / note when approved
  appliedAt: { type: Date, default: Date.now }, // ✅ when salesman applied
  actionAt: { type: Date, default: null }, // ✅ when admin approved/rejected
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Leave", LeaveSchema);
