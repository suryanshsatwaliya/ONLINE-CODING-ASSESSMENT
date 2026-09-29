import { model, Schema, ref } from "./shared.js";
export default model(
  "Student",
  {
    uid: { type: String, unique: true },
    name: String,
    course: String,
    section: String,
    email: String,
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    createdBy: ref("Teacher"),
  },
  [],
);
