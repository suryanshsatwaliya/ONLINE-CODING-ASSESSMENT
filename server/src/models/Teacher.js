import { model, Schema, ref } from "./shared.js";
export default model(
  "Teacher",
  {
    name: String,
    email: { type: String, unique: true, lowercase: true },
    username: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, select: false },
    role: { type: String, default: "TEACHER" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    tokenVersion: { type: Number, default: 0 },
    sessionsInvalidBefore: Date,
    lastLogin: Date,
  },
  [],
);
