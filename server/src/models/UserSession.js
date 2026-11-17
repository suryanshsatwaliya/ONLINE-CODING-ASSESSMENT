import { model } from "./shared.js";
export default model("UserSession", {
  userType: { type: String, enum: ["TEACHER", "STUDENT"], required: true }, userId: { type: String, required: true }, jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, ip: String, userAgent: String, lastSeenAt: Date,
}, [[{ userType: 1, userId: 1, expiresAt: 1 }, {}]]);
