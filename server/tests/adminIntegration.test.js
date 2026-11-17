import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

process.env.MONGODB_URI = "mongodb://127.0.0.1/master-admin-test";
process.env.JWT_SECRET = "master-admin-test-secret-at-least-32-characters";
process.env.NODE_ENV = "test";
process.env.ADMIN_TOTP_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
const { app } = await import("../src/app.js");
const { MasterAdmin, AdminSession, AuditLog, Teacher, Student, Assessment, AssessmentStudent } = await import("../src/models/index.js");
let repl;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await Promise.all(Object.values(await import("../src/models/index.js")).map((model) => model.init()));
  await MasterAdmin.create({ email: "root@example.com", passwordHash: await bcrypt.hash("Test-Admin-Password-123!", 4) });
});
after(async () => { await mongoose.disconnect(); await repl?.stop(); });

function totp(secret, now = Date.now()) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
  for (const char of secret) bits += chars.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((item) => parseInt(item, 2)));
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const digest = crypto.createHmac("sha1", key).update(message).digest(); const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}

test("Master Admin requires password, enrollment TOTP, CSRF, and active session for management", async () => {
  const agent = request.agent(app);
  assert.equal((await agent.get("/api/master-admin/overview")).status, 401);
  const passwordStage = await agent.post("/api/master-admin/auth/login").send({ email: "root@example.com", password: "Test-Admin-Password-123!" });
  assert.equal(passwordStage.status, 200);
  let csrf = passwordStage.body.csrfToken;
  const setup = await agent.get("/api/master-admin/auth/setup");
  assert.equal(setup.status, 200);
  assert.match(setup.body.qrCode, /^data:image\/png;base64,/);
  const enrollment = await agent.post("/api/master-admin/auth/verify").set("X-CSRF-Token", csrf).send({ code: totp(setup.body.secret) });
  assert.equal(enrollment.status, 200, JSON.stringify(enrollment.body));
  assert.equal(enrollment.body.recoveryCodes.length, 10);
  const admin = await MasterAdmin.findOne({ email: "root@example.com" }).select("+totpSecretEncrypted +recoveryCodeHashes");
  assert.equal(admin.totpEnabled, true);
  assert.equal(admin.totpSecretEncrypted.includes(setup.body.secret), false);
  assert.equal(admin.recoveryCodeHashes.includes(enrollment.body.recoveryCodes[0]), false);
  assert.equal((await agent.get("/api/master-admin/overview")).status, 200);
  assert.equal((await agent.post("/api/master-admin/security/recovery-codes")).status, 403, "write requests need the CSRF token");

  await agent.post("/api/master-admin/auth/logout").set("X-CSRF-Token", csrf);
  const loginAgain = await agent.post("/api/master-admin/auth/login").send({ email: "root@example.com", password: "Test-Admin-Password-123!" });
  assert.equal(loginAgain.status, 200);
  csrf = loginAgain.body.csrfToken;
  assert.equal(loginAgain.body.requiresTotp, true);
  const verified = await agent.post("/api/master-admin/auth/verify").set("X-CSRF-Token", csrf).send({ code: totp(setup.body.secret) });
  assert.equal(verified.status, 200);
  const session = await AdminSession.findOne({ status: "ACTIVE" });
  assert.ok(session.expiresAt > new Date());
  const recoveryResponse = await agent.post("/api/master-admin/security/recovery-codes").set("X-CSRF-Token", csrf);
  assert.equal(recoveryResponse.status, 200);
  assert.equal(recoveryResponse.body.recoveryCodes.length, 10);
  const events = await AuditLog.find({ eventType: { $in: ["ADMIN_TOTP_ENABLED", "ADMIN_LOGIN"] } });
  assert.ok(events.length >= 2);

  const createdTeacher = await agent.post("/api/master-admin/teachers").set("X-CSRF-Token", csrf).send({ name: "Managed Teacher", email: "managed@example.com", username: "managed-teacher" });
  assert.equal(createdTeacher.status, 201, JSON.stringify(createdTeacher.body));
  assert.equal(createdTeacher.body.emailSent, false);
  assert.equal(createdTeacher.body.teacher.passwordHash, undefined);
  const teacherRecord = await Teacher.findById(createdTeacher.body.teacher.id).select("+passwordHash");
  assert.ok(teacherRecord.passwordHash.startsWith("$2"));

  const originalTeacher = await Teacher.create({ name: "Owner", email: "owner@example.com", passwordHash: await bcrypt.hash("Owner-password-123!", 4) });
  const student = await Student.create({ uid: "ADMIN-STUDENT-1", name: "Managed Student", course: "CSE", section: "A", createdBy: originalTeacher._id });
  const assessment = await Assessment.create({ title: "History stays", createdBy: originalTeacher._id, status: "ENDED" });
  await AssessmentStudent.create({ student: student._id, assessment: assessment._id });
  const reassigned = await agent.put(`/api/master-admin/students/${student._id}`).set("X-CSRF-Token", csrf).send({ teacherId: createdTeacher.body.teacher.id });
  assert.equal(reassigned.status, 200);
  assert.equal(String((await Student.findById(student._id)).createdBy), createdTeacher.body.teacher.id);
  assert.equal(await AssessmentStudent.countDocuments({ student: student._id, assessment: assessment._id }), 1);
  const sectionList = await agent.get("/api/master-admin/sections");
  assert.equal(sectionList.status, 200);
  assert.ok(sectionList.body.rows.some((row) => row.section === "A"));
  const analytics = await agent.get("/api/master-admin/analytics");
  assert.equal(analytics.status, 200);
  assert.equal(analytics.body.measured, true);
  assert.equal(typeof analytics.body.uniqueAuthenticatedUsers, "number");
});
