import { model, ref } from "./shared.js";
export default model("TeacherResetToken", {
  teacher: ref("Teacher"), tokenHash: { type: String, required: true, unique: true }, expiresAt: { type: Date, required: true, index: { expires: 0 } }, usedAt: Date,
}, [[{ teacher: 1, usedAt: 1 }, {}]]);
