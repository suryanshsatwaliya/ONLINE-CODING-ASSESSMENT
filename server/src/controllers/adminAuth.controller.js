import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { MasterAdmin, AdminSession, LoginEvent } from "../models/index.js";
import { env } from "../config/env.js";
import { audit } from "../services/audit.service.js";
import { decryptSecret, encryptSecret, hashToken, makeRecoveryCodes, makeTotpSecret, randomToken, totpUri, verifyTotp } from "../services/security.service.js";
import ApiError from "../utils/ApiError.js";
import QRCode from "qrcode";
import { notifyAdmin } from "../services/email.service.js";
import { verifyTeacherCaptcha } from "../services/turnstile.service.js";
import { readCookie } from "../utils/adminCookies.js";
import { logAdminSession } from "../utils/adminSessionDiagnostics.js";
import mongoose from "mongoose";
const cookieBase = () => `Path=/; HttpOnly; SameSite=${env.NODE_ENV === "production" ? "None" : "Lax"}${env.NODE_ENV === "production" ? "; Secure" : ""}`;
const setSessionCookies = (res, token, csrf) => res.setHeader("Set-Cookie", [
  `master_session=${encodeURIComponent(token)}; ${cookieBase()}`,
  `master_csrf=${encodeURIComponent(csrf)}; Path=/; SameSite=${env.NODE_ENV === "production" ? "None" : "Lax"}${env.NODE_ENV === "production" ? "; Secure" : ""}`,
]);
const clearSessionCookies = (res) => res.setHeader("Set-Cookie", [`master_session=; ${cookieBase()}; Max-Age=0`, `master_csrf=; Path=/; SameSite=${env.NODE_ENV === "production" ? "None" : "Lax"}${env.NODE_ENV === "production" ? "; Secure" : ""}; Max-Age=0`]);
function ip(req) { return req.ip?.slice(0, 64); }
async function failed(req, email) {
  await LoginEvent.create({ userType: "MASTER_ADMIN", email, outcome: "FAILED", ip: ip(req), userAgent: req.get("user-agent") });
  await audit(req, "ADMIN_AUTH_FAILED", "Master Admin authentication failed", { actorType: "MASTER_ADMIN", actorEmail: email });
}
function sessionDuration() { return 15 * 60 * 1000; }
export async function start(req, res) {
  const cookieHeader = req.get("cookie");
  const token = readCookie(cookieHeader, "master_session");
  const entry = String(req.get("x-admin-entry") || "").replace(/^\/+|\/+$/g, "");
  if (token) {
    const session = await AdminSession.findOne({ tokenHash: hashToken(token) }).select("+csrfToken +routeId").populate("admin", "email totpEnabled");
    const routeId = entry.split("/")[0];
    if (session?.admin?.totpEnabled && session.expiresAt > new Date() && session.status === "ACTIVE" && session.routeId && routeId === session.routeId) {
      logAdminSession("entry_lookup_found", { endpoint: req.path, sessionCookiePresent: true, sessionRef: String(session._id), sessionStatus: session.status, dbReadyState: mongoose.connection.readyState });
      return res.json({ allowed: true, authenticated: true, routeId: session.routeId, csrfToken: session.csrfToken, user: { email: session.admin.email } });
    }
    const reason = !session ? "not_found" : session.expiresAt <= new Date() ? "expired" : session.status !== "ACTIVE" ? "not_active" : "route_mismatch";
    logAdminSession(`entry_lookup_${reason}`, { endpoint: req.path, sessionCookiePresent: true, sessionFound: Boolean(session), ...(session ? { sessionRef: String(session._id), sessionStatus: session.status } : {}), dbReadyState: mongoose.connection.readyState });
    await AdminSession.deleteOne({ tokenHash: hashToken(token) });
  } else {
    logAdminSession("entry_lookup_missing_cookie", { endpoint: req.path, cookieHeaderPresent: Boolean(cookieHeader), sessionCookiePresent: false, dbReadyState: mongoose.connection.readyState });
  }
  clearSessionCookies(res);
  res.json({ allowed: entry === env.MASTER_ADMIN_PATH, authenticated: false });
}
export function entryRedirect(req, res) {
  const clientOrigin = String(env.CLIENT_URL).split(",")[0].trim().replace(/\/$/, "");
  res.redirect(302, `${clientOrigin}/${env.MASTER_ADMIN_PATH}`);
}
async function createSession(admin, status, req, res, maxAge = sessionDuration()) {
  const token = randomToken(); const csrf = randomToken(24); const expiresAt = new Date(Date.now() + maxAge);
  const session = await AdminSession.create({ admin: admin._id, tokenHash: hashToken(token), csrfHash: hashToken(csrf), csrfToken: csrf, status, expiresAt, ip: ip(req), userAgent: req.get("user-agent")?.slice(0, 300) });
  logAdminSession("created", { sessionRef: String(session._id), sessionStatus: status, expiresInMs: maxAge, dbReadyState: mongoose.connection.readyState });
  setSessionCookies(res, token, csrf); return { csrfToken: csrf, expiresAt, state: status };
}
export async function login(req, res) {
  if (String(req.get("x-admin-entry") || "").replace(/^\/+|\/+$/g, "") !== env.MASTER_ADMIN_PATH) throw new ApiError(404, "Route not found.");
  await verifyTeacherCaptcha(req.body.captchaToken);
  const email = req.body.email.toLowerCase().trim();
  const admin = await MasterAdmin.findOne({ email }).select("+passwordHash +totpSecretEncrypted +pendingTotpEncrypted");
  if (!admin || (admin.lockedUntil && admin.lockedUntil > new Date()) || !(await bcrypt.compare(req.body.password, admin.passwordHash))) {
    if (admin) { admin.failedAttempts += 1; if (admin.failedAttempts >= 5) { admin.failedAttempts = 0; admin.lockedUntil = new Date(Date.now() + 15 * 60000); } await admin.save(); }
    await failed(req, email); throw new ApiError(401, "Invalid email or password, or account temporarily locked.");
  }
  admin.failedAttempts = 0; admin.lockedUntil = undefined; await admin.save();
  const session = await createSession(admin, admin.totpEnabled ? "PREAUTH" : "ENROLL", req, res, 5 * 60000);
  res.json({ ...session, requiresTotp: admin.totpEnabled, requiresEnrollment: !admin.totpEnabled });
}
export async function setup(req, res) {
  if (req.adminSession.status !== "ENROLL") throw new ApiError(409, "Authenticator enrollment is not pending.");
  const admin = await MasterAdmin.findById(req.admin.id).select("+pendingTotpEncrypted");
  if (!admin.pendingTotpEncrypted) { admin.pendingTotpEncrypted = encryptSecret(makeTotpSecret()); await admin.save(); }
  const secret = decryptSecret(admin.pendingTotpEncrypted);
  const otpauthUrl = totpUri(admin.email, secret);
  return res.json({ secret, otpauthUrl, qrCode: await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: "M", margin: 1, width: 220 }), email: admin.email });
}
export async function verify(req, res) {
  const admin = await MasterAdmin.findById(req.admin.id).select("+totpSecretEncrypted +pendingTotpEncrypted +recoveryCodeHashes");
  const code = String(req.body.code);
  if (req.adminSession.status === "ENROLL") {
    if (!admin.pendingTotpEncrypted || !verifyTotp(decryptSecret(admin.pendingTotpEncrypted), code)) { await failed(req, admin.email); throw new ApiError(401, "Authenticator code is invalid."); }
    const codes = makeRecoveryCodes(); admin.totpSecretEncrypted = admin.pendingTotpEncrypted; admin.pendingTotpEncrypted = undefined; admin.totpEnabled = true; admin.recoveryCodeHashes = codes.map(hashToken); admin.lastLogin = new Date(); await admin.save();
    req.adminSession.status = "ACTIVE"; req.adminSession.routeId = randomToken(24); req.adminSession.expiresAt = new Date(Date.now() + sessionDuration()); req.adminSession.lastSeenAt = new Date(); await req.adminSession.save();
    setSessionCookies(res, readCookie(req.get("cookie"), "master_session") || "", readCookie(req.get("cookie"), "master_csrf") || "");
    const recoveryCodes = codes;
    await LoginEvent.create({ userType: "MASTER_ADMIN", userId: String(admin._id), email: admin.email, outcome: "SUCCESS", ip: ip(req), userAgent: req.get("user-agent") });
    await audit(req, "ADMIN_TOTP_ENABLED", "Authenticator enabled");
    return res.json({ user: { email: admin.email }, recoveryCodes, state: "ACTIVE", routeId: req.adminSession.routeId });
  }
  if (req.adminSession.status !== "PREAUTH" || !admin.totpEnabled) throw new ApiError(409, "No authenticator verification is pending.");
  let accepted = verifyTotp(decryptSecret(admin.totpSecretEncrypted), code);
  if (!accepted) {
    const digest = hashToken(code.trim().toUpperCase()); const index = admin.recoveryCodeHashes.indexOf(digest);
    if (index >= 0) { const consumed = await MasterAdmin.updateOne({ _id: admin._id, recoveryCodeHashes: digest }, { $pull: { recoveryCodeHashes: digest } }); accepted = consumed.modifiedCount === 1; }
  }
  if (!accepted) { await failed(req, admin.email); throw new ApiError(401, "Authenticator code is invalid."); }
  await MasterAdmin.updateOne({ _id: admin._id }, { $set: { lastLogin: new Date() } }); req.adminSession.status = "ACTIVE"; req.adminSession.routeId = randomToken(24); req.adminSession.expiresAt = new Date(Date.now() + sessionDuration()); await req.adminSession.save();
  setSessionCookies(res, readCookie(req.get("cookie"), "master_session") || "", readCookie(req.get("cookie"), "master_csrf") || "");
  await LoginEvent.create({ userType: "MASTER_ADMIN", userId: String(admin._id), email: admin.email, outcome: "SUCCESS", ip: ip(req), userAgent: req.get("user-agent") });
  await audit(req, "ADMIN_LOGIN", "Master Admin logged in");
  res.json({ user: { email: admin.email }, state: "ACTIVE", routeId: req.adminSession.routeId });
}
export async function me(req, res) { res.json({ user: { email: req.admin.email }, state: req.admin.state, csrfToken: req.adminSession.csrfToken }); }
export async function logout(req, res) { await req.adminSession.deleteOne(); clearSessionCookies(res); await audit(req, "ADMIN_LOGOUT", "Master Admin logged out"); res.json({ success: true }); }
export async function recoveryCodes(req, res) {
  const admin = await MasterAdmin.findById(req.admin.id).select("+recoveryCodeHashes");
  const codes = makeRecoveryCodes(); admin.recoveryCodeHashes = codes.map(hashToken); await admin.save(); await audit(req, "ADMIN_RECOVERY_CODES_RESET", "Recovery codes regenerated"); res.json({ recoveryCodes: codes });
}
export async function changePassword(req, res) {
  const admin = await MasterAdmin.findById(req.admin.id).select("+passwordHash");
  if (!admin || !(await bcrypt.compare(req.body.currentPassword, admin.passwordHash))) throw new ApiError(401, "Current password is incorrect.");
  if (req.body.newPassword !== req.body.confirmation) throw new ApiError(400, "Passwords do not match.");
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,72}$/.test(req.body.newPassword)) throw new ApiError(400, "Use 12–72 characters with uppercase, lowercase, number, and special character.");
  admin.passwordHash = await bcrypt.hash(req.body.newPassword, 12); await admin.save();
  await AdminSession.deleteMany({ admin: admin._id, _id: { $ne: req.adminSession._id } });
  await audit(req, "ADMIN_PASSWORD_CHANGED", "Master Admin password changed");
  try { await notifyAdmin("AStarCoders: admin password changed", "The Master Admin password was changed. If you did not make this change, review active sessions."); } catch {}
  res.json({ success: true });
}
