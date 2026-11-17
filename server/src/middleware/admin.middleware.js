import { AdminSession } from "../models/index.js";
import { hashToken } from "../services/security.service.js";
import ApiError from "../utils/ApiError.js";
import { readCookie } from "../utils/adminCookies.js";
import { logAdminSession } from "../utils/adminSessionDiagnostics.js";
import mongoose from "mongoose";
const entryMatches = (req) => String(req.get("x-admin-entry") || "").replace(/^\/+|\/+$/g, "") === process.env.MASTER_ADMIN_PATH;
export async function adminSession(req, res, next) {
  try {
    const cookieHeader = req.get("cookie");
    const token = readCookie(cookieHeader, "master_session");
    const diagnostic = {
      method: req.method,
      endpoint: req.path,
      cookieHeaderPresent: Boolean(cookieHeader),
      sessionCookiePresent: Boolean(token),
      dbReadyState: mongoose.connection.readyState,
    };
    if (!token) {
      logAdminSession("lookup_missing_cookie", diagnostic);
      throw new ApiError(401, "Master Admin sign-in required.");
    }
    const session = await AdminSession.findOne({ tokenHash: hashToken(token) }).select("+csrfToken +routeId").populate("admin", "email totpEnabled");
    if (!session || !session.admin) {
      logAdminSession("lookup_not_found", { ...diagnostic, sessionFound: Boolean(session), adminFound: Boolean(session?.admin) });
      throw new ApiError(401, "Master Admin session expired.");
    }
    if (session.expiresAt <= new Date()) {
      logAdminSession("lookup_expired", { ...diagnostic, sessionRef: String(session._id), sessionStatus: session.status, expiredForMs: Date.now() - session.expiresAt.getTime() });
      throw new ApiError(401, "Master Admin session expired.");
    }
    logAdminSession("lookup_found", {
      ...diagnostic,
      sessionRef: String(session._id),
      sessionStatus: session.status,
      expiresInMs: Math.max(0, session.expiresAt.getTime() - Date.now()),
    });
    if (session.status === "ACTIVE") {
      if (!session.routeId || req.get("x-admin-route") !== session.routeId) throw new ApiError(401, "Admin route expired; sign in again.");
    } else if (!entryMatches(req)) throw new ApiError(401, "Open the configured Master Admin entry URL to continue.");
    const csrf = readCookie(cookieHeader, "master_csrf");
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      if (!csrf || !req.get("x-csrf-token") || hashToken(csrf) !== session.csrfHash || req.get("x-csrf-token") !== csrf) throw new ApiError(403, "Security token check failed.");
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
