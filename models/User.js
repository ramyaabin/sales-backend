import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // In production, hash this with bcrypt
    name: { type: String, required: true },
    role: { type: String, enum: ["admin", "salesman"], required: true },
    salesmanId: { type: String, unique: true, sparse: true }, // Only for salesmen
  },
  { timestamps: true },
);

export default mongoose.model("User", UserSchema);
