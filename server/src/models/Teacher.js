import { model, Schema, ref } from "./shared.js";
export default model(
  "Teacher",
  {
    name: String,
    email: { type: String, unique: true, lowercase: true },
    passwordHash: { type: String, select: false },
    role: { type: String, default: "TEACHER" },
  },
  [],
);
