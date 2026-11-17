import { AdminSession } from "../models/index.js";
import { hashToken } from "../services/security.service.js";
import ApiError from "../utils/ApiError.js";
const readCookie = (header, name) => header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
const entryMatches = (req) => String(req.get("x-admin-entry") || "").replace(/^\/+|\/+$/g, "") === process.env.MASTER_ADMIN_PATH;
export async function adminSession(req, res, next) {
  try {
    const token = readCookie(req.headers.cookie, "master_session");
    if (!token) throw new ApiError(401, "Master Admin sign-in required.");
    const session = await AdminSession.findOne({ tokenHash: hashToken(decodeURIComponent(token)), expiresAt: { $gt: new Date() } }).select("+csrfToken +routeId").populate("admin", "email totpEnabled");
    if (!session || !session.admin) throw new ApiError(401, "Master Admin session expired.");
    if (session.status === "ACTIVE") {
      if (!session.routeId || req.get("x-admin-route") !== session.routeId) throw new ApiError(401, "Admin route expired; sign in again.");
    } else if (!entryMatches(req)) throw new ApiError(401, "Open the configured Master Admin entry URL to continue.");
    const csrf = readCookie(req.headers.cookie, "master_csrf");
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      if (!csrf || !req.get("x-csrf-token") || hashToken(decodeURIComponent(csrf)) !== session.csrfHash || req.get("x-csrf-token") !== decodeURIComponent(csrf)) throw new ApiError(403, "Security token check failed.");
      const origin = req.get("origin");
      const allowed = String(process.env.CLIENT_URL || "").split(",").map((x) => x.trim().replace(/\/$/, ""));
      if (origin && !allowed.includes(origin.replace(/\/$/, ""))) throw new ApiError(403, "Request origin rejected.");
    }
    session.lastSeenAt = new Date(); await session.save();
    req.adminSession = session; req.admin = { id: String(session.admin._id), email: session.admin.email, totpEnabled: session.admin.totpEnabled, state: session.status };
    if (session.status === "ACTIVE" && !session.admin.totpEnabled) throw new ApiError(401, "Two-factor authentication setup is required.");
    next();
  } catch (error) { next(error); }
}
export function requireActiveAdmin(req, res, next) {
  if (req.adminSession?.status !== "ACTIVE" || !req.admin?.totpEnabled) return next(new ApiError(403, "Complete authenticator verification first."));
  next();
}
