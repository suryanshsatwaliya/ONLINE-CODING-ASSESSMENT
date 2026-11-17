import { AuditLog } from "../models/index.js";
export async function audit(req, eventType, action, options = {}) {
  try {
    await AuditLog.create({ eventType, action, actorType: options.actorType || (req?.admin ? "MASTER_ADMIN" : req?.user?.role || "SYSTEM"), actorId: options.actorId || req?.admin?.id || req?.user?.id, actorEmail: options.actorEmail || req?.admin?.email, targetType: options.targetType, targetId: options.targetId, metadata: options.metadata || {}, ip: req?.ip, userAgent: req?.get?.("user-agent") });
  } catch (error) { console.error("Audit log write failed:", error.message); }
}
