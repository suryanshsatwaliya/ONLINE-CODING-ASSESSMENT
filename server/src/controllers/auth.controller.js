import bcrypt from "bcrypt";
import {
  Teacher,
  Student,
  Assessment,
  AssessmentStudent,
  Attempt,
} from "../models/index.js";
import { issueToken } from "../services/auth.service.js";
import ApiError from "../utils/ApiError.js";
import { assessmentCodeKey } from "../services/assessmentCode.service.js";
import { assessmentAdmissionDeadline } from "../services/assessmentTiming.service.js";
import { env } from "../config/env.js";
import { teacherCaptchaEnabled, verifyTeacherCaptcha } from "../services/turnstile.service.js";
import { LoginEvent, TeacherResetToken, UserSession } from "../models/index.js";
import { audit } from "../services/audit.service.js";
import { hashToken, randomToken } from "../services/security.service.js";
import { sendEmail } from "../services/email.service.js";
import { randomUUID } from "node:crypto";

export function teacherCaptchaConfig(req, res) {
  res.json({
    enabled: teacherCaptchaEnabled,
    ...(teacherCaptchaEnabled ? { siteKey: env.TURNSTILE_SITE_KEY } : {}),
  });
}

export async function teacherLogin(req, res) {
  await verifyTeacherCaptcha(req.body.captchaToken);
  const identifier = String(req.body.email || req.body.identifier || "").trim().toLowerCase();
  const t = await Teacher.findOne({ $or: [{ email: identifier }, { username: identifier }], status: { $ne: "INACTIVE" } }).select("+passwordHash");
  if (!t || !(await bcrypt.compare(req.body.password, t.passwordHash))) {
    await LoginEvent.create({ userType: "TEACHER", email: identifier, outcome: "FAILED", ip: req.ip, userAgent: req.get("user-agent") });
    await audit(req, "TEACHER_LOGIN_FAILED", "Teacher sign-in failed", { actorType: "TEACHER", actorEmail: identifier });
    throw new ApiError(401, "Invalid email or password");
  }
  t.lastLogin = new Date(); await t.save();
  const jti = randomUUID(); await createLoginSession(req, "TEACHER", t._id, jti);
  await LoginEvent.create({ userType: "TEACHER", userId: String(t._id), email: t.email, outcome: "SUCCESS", ip: req.ip, userAgent: req.get("user-agent") });
  await audit(req, "TEACHER_LOGIN", "Teacher signed in", { actorType: "TEACHER", actorId: String(t._id), actorEmail: t.email });
  res.json({
    token: issueToken({ id: String(t._id), role: "TEACHER", tokenVersion: t.tokenVersion || 0, jti }),
    user: { id: t._id, name: t.name, email: t.email, role: "TEACHER" },
  });
}
export async function verifyStudent(req, res) {
  const s = await Student.findOne({
    uid: req.body.uid.trim().toUpperCase(),
    status: "ACTIVE",
  });
  if (!s) throw new ApiError(401, "Student unavailable. Contact your teacher.");
  res.json({ name: s.name, course: s.course, section: s.section });
}
export async function studentLogin(req, res) {
  const s = await Student.findOne({
    uid: req.body.uid.trim().toUpperCase(),
    status: "ACTIVE",
  });
  const a = await Assessment.findOne({ accessCodeKey: assessmentCodeKey(req.body.accessCode) }).select(
    "+accessCodeHash",
  );
  const assignment = s && a ? await AssessmentStudent.findOne({ student: s._id, assessment: a._id }) : null;
  const attempt = s && a ? await Attempt.findOne({ student: s._id, assessment: a._id }).select("status expiresAt") : null;
  const attemptClosed = Boolean(attempt && attempt.status !== "ACTIVE" && !assignment?.reentryAllowed);
  const activeAttempt = attempt?.status === "ACTIVE" && attempt.expiresAt > new Date();
  const canReenter = a?.status === "LIVE" && assignment?.reentryAllowed;
  if (
    !s ||
    !a ||
    !a.accessCodeHash ||
    (!["SCHEDULED", "LIVE"].includes(a.status) && !attemptClosed && !activeAttempt) ||
    (assessmentAdmissionDeadline(a) <= Date.now() && !canReenter && !attemptClosed && !activeAttempt) ||
    !assignment ||
    !(await bcrypt.compare(req.body.accessCode, a.accessCodeHash))
  )
    throw new ApiError(401, "Invalid assessment access details");
  s.lastLogin = new Date(); await s.save();
  const jti = randomUUID(); await createLoginSession(req, "STUDENT", s._id, jti);
  await LoginEvent.create({ userType: "STUDENT", userId: String(s._id), outcome: "SUCCESS", ip: req.ip, userAgent: req.get("user-agent") });
  await audit(req, "STUDENT_LOGIN", "Student signed in", { actorType: "STUDENT", actorId: String(s._id), targetType: "Assessment", targetId: String(a._id) });
  res.json({
    token: issueToken({
      id: String(s._id),
      role: "STUDENT",
      assessmentId: String(a._id),
      jti,
    }),
    user: {
      id: s._id,
      name: s.name,
      uid: s.uid,
      section: s.section,
      email: s.email,
      role: "STUDENT",
      assessmentId: a._id,
      attemptStatus: attempt?.status || null,
      closedAttempt: attemptClosed,
      reentryAllowed: Boolean(assignment?.reentryAllowed),
    },
  });
}
const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,128}$/;
function jwtLifetimeMs(value) { const match = /^(\d+)(s|m|h|d)$/.exec(String(value)); if (!match) return 8 * 60 * 60 * 1000; return Number(match[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]]); }
async function createLoginSession(req, userType, userId, jti) { await UserSession.create({ userType, userId: String(userId), jti, expiresAt: new Date(Date.now() + jwtLifetimeMs(env.JWT_EXPIRES_IN)), ip: req.ip, userAgent: req.get("user-agent")?.slice(0, 300), lastSeenAt: new Date() }); }
export async function logout(req, res) { if (req.user?.jti) await UserSession.deleteOne({ jti: req.user.jti }); res.json({ success: true }); }
export async function requestTeacherReset(req, res) {
  const identity = String(req.body.identity || "").trim().toLowerCase();
  const teacher = await Teacher.findOne({ $or: [{ email: identity }, { username: identity }], status: { $ne: "INACTIVE" } });
  if (teacher) {
    const token = randomToken(); await TeacherResetToken.deleteMany({ teacher: teacher._id, usedAt: { $exists: false } });
    await TeacherResetToken.create({ teacher: teacher._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 15 * 60000) });
    const link = `${String(env.PUBLIC_APP_URL || env.CLIENT_URL).split(",")[0].trim().replace(/\/$/, "")}/login/teacher/reset?token=${encodeURIComponent(token)}`;
    try { await sendEmail({ to: teacher.email, subject: "Reset your AStarCoders password", text: `Use this link within 15 minutes to reset your password: ${link}` }); }
    catch (error) { console.error("Teacher reset email failed:", error.message); }
  }
  res.json({ message: "If an account matches those details, password reset instructions will be sent." });
}
export async function resetTeacherPassword(req, res) {
  const { token, password, confirmation } = req.body;
  if (password !== confirmation) throw new ApiError(400, "Passwords do not match.");
  if (!passwordRule.test(password)) throw new ApiError(400, "Use at least 12 characters with uppercase, lowercase, number, and special character.");
  const record = await TeacherResetToken.findOne({ tokenHash: hashToken(token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
  if (!record) throw new ApiError(400, "This reset link is invalid or expired.");
  const teacher = await Teacher.findById(record.teacher); if (!teacher || teacher.status === "INACTIVE") throw new ApiError(400, "This reset link is invalid or expired.");
  const consumed = await TeacherResetToken.findOneAndUpdate({ _id: record._id, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } }, { new: true });
  if (!consumed) throw new ApiError(400, "This reset link is invalid or expired.");
  teacher.passwordHash = await bcrypt.hash(password, 12); teacher.tokenVersion = (teacher.tokenVersion || 0) + 1; teacher.sessionsInvalidBefore = new Date(); await teacher.save();
  await UserSession.deleteMany({ userType: "TEACHER", userId: String(teacher._id) });
  await TeacherResetToken.deleteMany({ teacher: teacher._id, _id: { $ne: consumed._id } });
  try { await sendEmail({ to: teacher.email, subject: "Your AStarCoders password was changed", text: "Your teacher account password was changed. If you did not make this change, contact your administrator." }); } catch (error) { console.error("Password change notice failed:", error.message); }
  await audit(req, "TEACHER_PASSWORD_RESET", "Teacher password reset completed", { actorType: "TEACHER", actorId: String(teacher._id), actorEmail: teacher.email });
  res.json({ success: true });
}
export async function me(req, res) {
  if (req.user.role !== "STUDENT") return res.json(req.user);
  const [student, attempt, assignment] = await Promise.all([
    Student.findById(req.user.id).select("name uid section email"),
    Attempt.findOne({ student: req.user.id, assessment: req.user.assessmentId }).select("status"),
    AssessmentStudent.findOne({ student: req.user.id, assessment: req.user.assessmentId }).select("reentryAllowed"),
  ]);
  if (!student) throw new ApiError(404, "Student profile not found");
  const reentryAllowed = Boolean(assignment?.reentryAllowed);
  res.json({
    user: {
      id: student._id,
      name: student.name,
      uid: student.uid,
      section: student.section,
      email: student.email,
      role: "STUDENT",
      assessmentId: req.user.assessmentId,
      attemptStatus: attempt?.status || null,
      closedAttempt: Boolean(attempt && attempt.status !== "ACTIVE" && !reentryAllowed),
      reentryAllowed,
    },
  });
}
