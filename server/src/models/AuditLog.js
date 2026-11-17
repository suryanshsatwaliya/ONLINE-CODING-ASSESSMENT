import { model } from "./shared.js";
export default model("AuditLog", {
  eventType: { type: String, required: true, index: true }, actorType: String, actorId: String, actorEmail: String,
  targetType: String, targetId: String, action: String, metadata: Object, ip: String, userAgent: String,
}, [[{ createdAt: -1 }, {}], [{ actorId: 1, createdAt: -1 }, {}]]);
