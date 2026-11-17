import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { Teacher, Student, Assessment, AssessmentStudent, Attempt, Result, AdminSession, AuditLog, LoginEvent, UserSession } from "../models/index.js";
import { audit } from "../services/audit.service.js";
import { sendEmail, notifyAdmin } from "../services/email.service.js";
import { hashToken } from "../services/security.service.js";
import ApiError from "../utils/ApiError.js";
import mongoose from "mongoose";
import { closeAttempt } from "../services/attemptLifecycle.service.js";
import { gradeAttempt } from "../services/grading.service.js";
import { emitAssessment } from "../services/realtime.service.js";

const password = () => `${crypto.randomBytes(12).toString("base64url")}aA1!`;
const publicTeacher = (teacher) => ({ id: String(teacher._id), name: teacher.name, email: teacher.email, username: teacher.username, status: teacher.status || "ACTIVE", createdAt: teacher.createdAt, lastLogin: teacher.lastLogin });
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
export async function overview(req, res) {
  const [students, teachers, registeredTeachers, assessments, attempts, sections, activeSessions] = await Promise.all([
    Student.countDocuments(), Teacher.countDocuments({ status: { $ne: "INACTIVE" } }), Teacher.countDocuments(), Assessment.countDocuments(), Attempt.countDocuments(),
    Student.aggregate([{ $group: { _id: { course: "$course", section: "$section" } } }, { $count: "count" }]),
    Promise.all([AdminSession.countDocuments({ status: "ACTIVE", expiresAt: { $gt: new Date() } }), UserSession.countDocuments({ expiresAt: { $gt: new Date() } })]).then(([admins, users]) => admins + users),
  ]);
  res.json({ students, teachers, registeredUsers: students + registeredTeachers, assessments, completions: await Attempt.countDocuments({ status: { $in: ["SUBMITTED", "TERMINATED", "EXPIRED"] } }), sections: sections[0]?.count || 0, activeSessions });
}
export async function listTeachers(req, res) {
  const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1)); const search = String(req.query.search || "").slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = search ? { $or: ["name", "email", "username"].map((key) => ({ [key]: { $regex: search, $options: "i" } })) } : {};
  const [rows, total] = await Promise.all([Teacher.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).lean(), Teacher.countDocuments(filter)]);
  const ids = rows.map((x) => x._id);
  const [studentCounts, assessmentCounts] = await Promise.all([
    Student.aggregate([{ $match: { createdBy: { $in: ids } } }, { $group: { _id: "$createdBy", count: { $sum: 1 }, sections: { $addToSet: { course: "$course", section: "$section" } } } }]),
    Assessment.aggregate([{ $match: { createdBy: { $in: ids } } }, { $group: { _id: "$createdBy", count: { $sum: 1 } } }]),
  ]);
  const students = new Map(studentCounts.map((x) => [String(x._id), x])); const assessments = new Map(assessmentCounts.map((x) => [String(x._id), x.count]));
  res.json({ rows: rows.map((teacher) => ({ ...publicTeacher(teacher), students: students.get(String(teacher._id))?.count || 0, sections: students.get(String(teacher._id))?.sections || [], assessments: assessments.get(String(teacher._id)) || 0 })), total });
}
export async function createTeacher(req, res) {
  const email = req.body.email.trim().toLowerCase(); const username = req.body.username.trim().toLowerCase();
  if (await Teacher.exists({ $or: [{ email }, { username }] })) throw new ApiError(409, "Email or username is already assigned.");
  const temporaryPassword = password();
  const teacher = await Teacher.create({ name: req.body.name.trim(), email, username, passwordHash: await bcrypt.hash(temporaryPassword, 12), role: "TEACHER", status: "ACTIVE" });
  let emailSent = false;
  try { const sent = await sendEmail({ to: email, subject: "Your AStarCoders teacher account", text: `Your account is ready. Username: ${username}. Temporary password: ${temporaryPassword}. Please sign in and change your password.`, html: `<p>Your teacher account is ready.</p><p>Username: <strong>${escapeHtml(username)}</strong><br>Temporary password: <strong>${escapeHtml(temporaryPassword)}</strong></p><p>Please sign in and change your password.</p>` }); emailSent = sent.sent; }
  catch (error) { await audit(req, "TEACHER_CREDENTIAL_EMAIL_FAILED", "Teacher credential email failed", { targetType: "Teacher", targetId: String(teacher._id), metadata: { message: error.message } }); }
  await audit(req, "TEACHER_CREATED", "Teacher account created", { targetType: "Teacher", targetId: String(teacher._id), metadata: { email, username } });
  try { await notifyAdmin("AStarCoders: teacher account created", `A teacher account was created for ${email}. Credential delivery: ${emailSent ? "sent" : "failed"}.`); } catch {}
  res.status(201).json({ teacher: publicTeacher(teacher), emailSent, credentials: emailSent ? undefined : "Email delivery failed. Use Reset password to send a new temporary password." });
}
export async function updateTeacher(req, res) {
  const teacher = await Teacher.findById(req.params.id); if (!teacher) throw new ApiError(404, "Teacher not found.");
  const email = req.body.email?.trim().toLowerCase(); const username = req.body.username?.trim().toLowerCase();
  if (await Teacher.exists({ _id: { $ne: teacher._id }, $or: [{ email }, { username }] })) throw new ApiError(409, "Email or username is already assigned.");
  if (req.body.name) teacher.name = req.body.name.trim(); if (email) teacher.email = email; if (username) teacher.username = username;
  if (req.body.status && ["ACTIVE", "INACTIVE"].includes(req.body.status)) { if (teacher.status !== req.body.status && req.body.status === "INACTIVE") { teacher.tokenVersion += 1; teacher.sessionsInvalidBefore = new Date(); await UserSession.deleteMany({ userType: "TEACHER", userId: String(teacher._id) }); } teacher.status = req.body.status; }
  await teacher.save(); await audit(req, "TEACHER_UPDATED", "Teacher account updated", { targetType: "Teacher", targetId: String(teacher._id), metadata: { fields: Object.keys(req.body) } });
  if (req.body.status === "INACTIVE") { try { await notifyAdmin("AStarCoders: teacher deactivated", `Teacher account ${teacher.email} was deactivated.`); } catch {} }
  res.json({ teacher: publicTeacher(teacher) });
}
export async function deleteTeacher(req, res) {
  const teacher = await Teacher.findById(req.params.id); if (!teacher) throw new ApiError(404, "Teacher not found.");
  const dependencies = await Promise.all([Student.exists({ createdBy: teacher._id }), Assessment.exists({ createdBy: teacher._id })]);
  if (dependencies.some(Boolean)) { teacher.status = "INACTIVE"; teacher.tokenVersion += 1; teacher.sessionsInvalidBefore = new Date(); await teacher.save(); await UserSession.deleteMany({ userType: "TEACHER", userId: String(teacher._id) }); await audit(req, "TEACHER_DEACTIVATED", "Teacher account deactivated to preserve assessment history", { targetType: "Teacher", targetId: String(teacher._id) }); return res.json({ success: true, deactivated: true }); }
  await UserSession.deleteMany({ userType: "TEACHER", userId: String(teacher._id) }); await teacher.deleteOne(); await audit(req, "TEACHER_DELETED", "Teacher account deleted", { targetType: "Teacher", targetId: String(teacher._id) }); res.json({ success: true });
}
export async function resetTeacherPassword(req, res) {
  const teacher = await Teacher.findById(req.params.id); if (!teacher) throw new ApiError(404, "Teacher not found.");
  const temporaryPassword = password(); teacher.passwordHash = await bcrypt.hash(temporaryPassword, 12); teacher.tokenVersion += 1; teacher.sessionsInvalidBefore = new Date(); await teacher.save(); await UserSession.deleteMany({ userType: "TEACHER", userId: String(teacher._id) });
  let emailSent = false; try { const sent = await sendEmail({ to: teacher.email, subject: "Your AStarCoders password was reset", text: `Your temporary password is: ${temporaryPassword}. Sign in and replace it as soon as possible.` }); emailSent = sent.sent; } catch {}
  try { await notifyAdmin("AStarCoders: teacher password reset", `A temporary password reset was initiated for ${teacher.email}. Delivery: ${emailSent ? "sent" : "failed"}.`); } catch {}
  await audit(req, "TEACHER_PASSWORD_RESET", "Temporary teacher password generated", { targetType: "Teacher", targetId: String(teacher._id), metadata: { emailSent } }); res.json({ success: true, emailSent });
}
export async function listStudents(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const filter = {}; const q = String(req.query.search || "").trim(); if (q) filter.$or = ["name", "uid", "email", "section", "course"].map((key) => ({ [key]: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }));
  if (req.query.teacherId) filter.createdBy = req.query.teacherId; if (req.query.course) filter.course = req.query.course; if (req.query.section) filter.section = req.query.section; if (req.query.status) filter.status = req.query.status;
  const [rows, total] = await Promise.all([Student.find(filter).populate("createdBy", "name email username").sort({ uid: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(), Student.countDocuments(filter)]);
  const ids = rows.map((x) => x._id);
  const [assigned, attempts, histories] = await Promise.all([
    AssessmentStudent.aggregate([{ $match: { student: { $in: ids } } }, { $lookup: { from: "assessments", localField: "assessment", foreignField: "_id", as: "assessment" } }, { $unwind: "$assessment" }, { $group: { _id: "$student", count: { $sum: 1 } } }]),
    Attempt.aggregate([{ $match: { student: { $in: ids } } }, { $group: { _id: "$student", count: { $sum: 1 }, latest: { $max: "$updatedAt" } } }]),
    Attempt.aggregate([{ $match: { student: { $in: ids } } }, { $sort: { updatedAt: -1 } }, { $lookup: { from: "assessments", localField: "assessment", foreignField: "_id", as: "assessment" } }, { $unwind: "$assessment" }, { $group: { _id: "$student", rows: { $push: { title: "$assessment.title", status: "$status", updatedAt: "$updatedAt" } } } }, { $project: { rows: { $slice: ["$rows", 5] } } }]),
  ]);
  const assignments = new Map(assigned.map((x) => [String(x._id), x.count])); const history = new Map(attempts.map((x) => [String(x._id), x])); const latest = new Map(histories.map((x) => [String(x._id), x.rows]));
  res.json({ rows: rows.map((student) => ({ ...student, teacher: student.createdBy, createdBy: undefined, participation: assignments.get(String(student._id)) || 0, submissions: history.get(String(student._id))?.count || 0, lastActivity: history.get(String(student._id))?.latest || null, history: latest.get(String(student._id)) || [] })), total, page, pages: Math.ceil(total / limit) });
}
export async function updateStudent(req, res) {
  const student = await Student.findById(req.params.id); if (!student) throw new ApiError(404, "Student not found.");
  if (req.body.teacherId) {
    const teacher = await Teacher.findOne({ _id: req.body.teacherId, status: { $ne: "INACTIVE" } }); if (!teacher) throw new ApiError(400, "Choose an active teacher."); student.createdBy = teacher._id;
  }
  for (const field of ["name", "email", "course", "section", "status"]) if (req.body[field] !== undefined) student[field] = req.body[field];
  if (req.body.status === "INACTIVE") await UserSession.deleteMany({ userType: "STUDENT", userId: String(student._id) });
  await student.save(); await audit(req, "STUDENT_REASSIGNED", "Student record updated or reassigned", { targetType: "Student", targetId: String(student._id), metadata: { teacherId: String(student.createdBy), section: student.section } }); res.json({ success: true });
}
export async function sections(req, res) {
  const rows = await Student.aggregate([{ $group: { _id: { course: "$course", section: "$section", teacher: "$createdBy" }, students: { $sum: 1 }, activeStudents: { $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] } } } }, { $lookup: { from: "teachers", localField: "_id.teacher", foreignField: "_id", as: "teacher" } }, { $unwind: { path: "$teacher", preserveNullAndEmptyArrays: true } }, { $project: { course: "$_id.course", section: "$_id.section", teacher: "$teacher.name", teacherId: "$_id.teacher", students: 1, activeStudents: 1 } }, { $sort: { course: 1, section: 1 } }]); res.json({ rows });
}
export async function reassignSection(req, res) {
  const teacher = await Teacher.findOne({ _id: req.body.teacherId, status: { $ne: "INACTIVE" } }); if (!teacher) throw new ApiError(400, "Choose an active teacher.");
  const result = await Student.updateMany({ course: req.body.course, section: req.body.section }, { $set: { createdBy: teacher._id } });
  await audit(req, "SECTION_REASSIGNED", "Section students reassigned", { metadata: { course: req.body.course, section: req.body.section, count: result.modifiedCount, teacherId: String(teacher._id) } }); res.json({ modified: result.modifiedCount });
}
export async function assessments(req, res) {
  const rows = await Assessment.find().populate("createdBy", "name email").sort({ createdAt: -1 }).limit(300).lean();
  const ids = rows.map((x) => x._id); const [assignments, completions] = await Promise.all([AssessmentStudent.aggregate([{ $match: { assessment: { $in: ids } } }, { $group: { _id: "$assessment", count: { $sum: 1 } } }]), Attempt.aggregate([{ $match: { assessment: { $in: ids }, status: { $in: ["SUBMITTED", "TERMINATED", "EXPIRED"] } } }, { $group: { _id: "$assessment", count: { $sum: 1 } } }])]);
  const am = new Map(assignments.map((x) => [String(x._id), x.count])), cm = new Map(completions.map((x) => [String(x._id), x.count])); res.json({ rows: rows.map((x) => ({ ...x, teacher: x.createdBy?.name || "Unassigned", assigned: am.get(String(x._id)) || 0, completions: cm.get(String(x._id)) || 0 })) });
}
export async function endAssessment(req, res) {
  let assessment; const attemptIds = [];
  await mongoose.connection.transaction(async (session) => {
    assessment = await Assessment.findOneAndUpdate({ _id: req.params.id, status: "LIVE" }, { $inc: { revision: 1 } }, { new: true, session });
    if (!assessment) throw new ApiError(409, "Only a live assessment can be ended.");
    assessment.status = "ENDED"; assessment.endedAt = new Date(); assessment.endReason = "TEACHER"; assessment.revision++;
    const active = await Attempt.find({ assessment: assessment._id, status: "ACTIVE" }).session(session);
    for (const attempt of active) { await closeAttempt(attempt, assessment, "SUBMITTED", session); await attempt.save({ session }); attemptIds.push(attempt._id); }
    await assessment.save({ session });
  });
  for (const id of attemptIds) await gradeAttempt(id);
  emitAssessment(assessment, "ASSESSMENT_ENDED", { assessmentId: assessment._id });
  await audit(req, "ASSESSMENT_TERMINATED_BY_ADMIN", "Master Admin ended assessment", { targetType: "Assessment", targetId: String(assessment._id), metadata: { attemptsSubmitted: attemptIds.length } });
  res.json({ success: true, submittedAttempts: attemptIds.length });
}
export async function deleteAssessment(req, res) {
  await mongoose.connection.transaction(async (session) => {
    const assessment = await Assessment.findById(req.params.id).session(session);
    if (!assessment) throw new ApiError(404, "Assessment not found.");
    if (await Attempt.exists({ assessment: assessment._id }).session(session)) throw new ApiError(409, "Assessment history exists. Keep the record to preserve submissions.");
    await AssessmentStudent.deleteMany({ assessment: assessment._id }).session(session);
    await assessment.deleteOne({ session });
  });
  await audit(req, "ASSESSMENT_DELETED", "Master Admin deleted assessment", { targetType: "Assessment", targetId: req.params.id });
  res.json({ success: true });
}
export async function analytics(req, res) {
  const now = new Date(); const since = new Date(now.getTime() - 30 * 86400000);
  const localToday = new Date(now.getTime() + 330 * 60000);
  const todayStart = new Date(Date.UTC(localToday.getUTCFullYear(), localToday.getUTCMonth(), localToday.getUTCDate()) - 330 * 60000);
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const [logins, todayLoginRows, teacherStats, studentStats, statuses, sections, teachers, totals, weeklyLogins, weeklyActiveUsers, monthlyActiveUsers] = await Promise.all([
    LoginEvent.aggregate([{ $match: { userType: { $in: ["TEACHER", "STUDENT"] }, createdAt: { $gte: since }, outcome: "SUCCESS" } }, { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } }, logins: { $sum: 1 }, users: { $addToSet: "$userId" } } }, { $project: { date: "$_id", logins: 1, activeUsers: { $size: "$users" } } }, { $sort: { date: 1 } }]),
    LoginEvent.aggregate([{ $match: { userType: { $in: ["TEACHER", "STUDENT"] }, outcome: "SUCCESS", createdAt: { $gte: todayStart, $lt: tomorrowStart } } }, { $group: { _id: { $dateToString: { date: "$createdAt", format: "%H", timezone: "Asia/Kolkata" } }, logins: { $sum: 1 } } }]),
    LoginEvent.aggregate([{ $match: { userType: "TEACHER", createdAt: { $gte: since }, outcome: "SUCCESS" } }, { $group: { _id: "$userId", logins: { $sum: 1 }, lastLogin: { $max: "$createdAt" } } }, { $sort: { logins: -1 } }, { $limit: 50 }, { $lookup: { from: "teachers", let: { id: "$_id" }, pipeline: [{ $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$id"] } } }, { $project: { name: 1, email: 1 } }], as: "profile" } }, { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } }, { $project: { logins: 1, lastLogin: 1, name: "$profile.name", email: "$profile.email" } }]),
    LoginEvent.aggregate([{ $match: { userType: "STUDENT", createdAt: { $gte: since }, outcome: "SUCCESS" } }, { $group: { _id: "$userId", logins: { $sum: 1 }, lastLogin: { $max: "$createdAt" } } }, { $sort: { logins: -1 } }, { $limit: 50 }, { $lookup: { from: "students", let: { id: "$_id" }, pipeline: [{ $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$id"] } } }, { $project: { name: 1, uid: 1 } }], as: "profile" } }, { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } }, { $project: { logins: 1, lastLogin: 1, name: "$profile.name", uid: "$profile.uid" } }]),
    Attempt.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Student.aggregate([{ $group: { _id: { section: "$section", course: "$course" }, students: { $sum: 1 }, studentIds: { $push: "$_id" } } }, { $lookup: { from: "attempts", localField: "studentIds", foreignField: "student", as: "attempts" } }, { $project: { _id: 1, students: 1, completions: { $size: { $filter: { input: "$attempts", as: "attempt", cond: { $in: ["$$attempt.status", ["SUBMITTED", "TERMINATED", "EXPIRED"]] } } } } } }, { $sort: { students: -1 } }, { $limit: 50 }]),
    Teacher.aggregate([{ $lookup: { from: "students", localField: "_id", foreignField: "createdBy", as: "students" } }, { $lookup: { from: "assessments", localField: "_id", foreignField: "createdBy", as: "assessments" } }, { $project: { name: 1, students: { $size: "$students" }, assessments: { $size: "$assessments" } } }, { $sort: { students: -1 } }, { $limit: 50 }]),
    Promise.all([Student.countDocuments(), Teacher.countDocuments({ status: { $ne: "INACTIVE" } }), Assessment.countDocuments(), Attempt.countDocuments({ status: { $in: ["SUBMITTED", "TERMINATED", "EXPIRED"] } })]),
    LoginEvent.countDocuments({ userType: { $in: ["TEACHER", "STUDENT"] }, createdAt: { $gte: new Date(now.getTime() - 7 * 86400000) }, outcome: "SUCCESS" }),
    LoginEvent.distinct("userId", { userType: { $in: ["TEACHER", "STUDENT"] }, createdAt: { $gte: new Date(now.getTime() - 7 * 86400000) }, outcome: "SUCCESS" }).then((ids) => ids.length),
    LoginEvent.distinct("userId", { userType: { $in: ["TEACHER", "STUDENT"] }, createdAt: { $gte: since }, outcome: "SUCCESS" }).then((ids) => ids.length),
  ]);
  const uniqueVisitors = await LoginEvent.distinct("userId", { userType: { $in: ["TEACHER", "STUDENT"] }, createdAt: { $gte: since }, outcome: "SUCCESS" });
  const hourlyMap = new Map(todayLoginRows.map((row) => [Number(row._id), row.logins]));
  const todayLogins = Array.from({ length: 24 }, (_, hour) => ({ hour, logins: hourlyMap.get(hour) || 0 }));
  res.json({ periodDays: 30, measured: true, todayTimeZone: "Asia/Kolkata", todayLoginTotal: todayLogins.reduce((sum, row) => sum + row.logins, 0), todayLogins, uniqueAuthenticatedUsers: uniqueVisitors.length, dailyLogins: logins, weeklyLogins, monthlyLogins: logins.reduce((sum, row) => sum + row.logins, 0), weeklyActiveUsers, monthlyActiveUsers, peakDailyLogins: Math.max(0, ...logins.map((row) => row.logins)), peakDailyActiveUsers: Math.max(0, ...logins.map((row) => row.activeUsers)), teacherLogins: teacherStats, studentLogins: studentStats, assessmentStatus: statuses, sectionParticipation: sections, teacherParticipation: teachers, totals: { students: totals[0], teachers: totals[1], assessments: totals[2], completions: totals[3] } });
}
export async function logs(req, res) {
  const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1)); const filter = {}; if (req.query.type) filter.eventType = String(req.query.type).slice(0, 80); const search = String(req.query.search || "").slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); if (search) filter.$or = [{ action: { $regex: search, $options: "i" } }, { actorEmail: { $regex: search, $options: "i" } }, { targetId: { $regex: search, $options: "i" } }];
  const [rows, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50).lean(), AuditLog.countDocuments(filter)]); res.json({ rows, total, page });
}
export async function securitySettings(req, res) {
  const [admin, activeSessions] = await Promise.all([ (await import("../models/index.js")).MasterAdmin.findById(req.admin.id).select("email totpEnabled recoveryCodeHashes lastLogin"), AdminSession.countDocuments({ admin: req.admin.id, status: "ACTIVE", expiresAt: { $gt: new Date() } }) ]);
  res.json({ email: admin.email, totpEnabled: admin.totpEnabled, remainingRecoveryCodes: admin.recoveryCodeHashes.length, lastLogin: admin.lastLogin, activeSessions, sessionHours: Number(process.env.ADMIN_SESSION_HOURS || 8), secretPathConfigured: Boolean(process.env.MASTER_ADMIN_PATH) });
}
export async function revokeSessions(req, res) { const result = await AdminSession.deleteMany({ admin: req.admin.id, _id: { $ne: req.adminSession._id } }); await audit(req, "ADMIN_SESSIONS_REVOKED", "Other Master Admin sessions revoked", { metadata: { count: result.deletedCount } }); res.json({ revoked: result.deletedCount }); }
