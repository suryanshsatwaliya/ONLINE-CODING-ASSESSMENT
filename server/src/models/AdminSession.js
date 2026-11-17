import { model, ref } from "./shared.js";
export default model("AdminSession", {
  admin: ref("MasterAdmin"), tokenHash: { type: String, required: true, unique: true },
  csrfHash: { type: String, required: true }, csrfToken: { type: String, required: true, select: false }, routeId: { type: String, select: false }, status: { type: String, enum: ["PREAUTH", "ENROLL", "ACTIVE"], required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, lastSeenAt: Date, ip: String, userAgent: String,
}, [[{ admin: 1, status: 1, expiresAt: 1 }, {}]]);
