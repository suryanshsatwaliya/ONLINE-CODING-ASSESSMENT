import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import bcrypt from "bcrypt";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test";
process.env.JWT_SECRET = "integration-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";
const { app } = await import("../src/app.js");
const M = await import("../src/models/index.js");
const { issueToken } = await import("../src/services/auth.service.js");
const { questionSchema } =
  await import("../src/validators/assessment.validator.js");
const { expireAttempts } =
  await import("../src/services/attemptLifecycle.service.js");
let repl, teacher, teacher2, student, student2, token, a, studentToken, attempt;
const auth = (t) => ({ Authorization: "Bearer " + t });
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await Promise.all(Object.values(M).map((m) => m.init()));
  teacher = await M.Teacher.create({
    name: "Teacher",
    email: "t@example.com",
    passwordHash: await bcrypt.hash("longpassword123", 4),
  });
  teacher2 = await M.Teacher.create({
    name: "Other",
    email: "o@example.com",
    passwordHash: "x",
  });
  student = await M.Student.create({
    uid: "ST1",
    name: "Student",
    course: "CSE",
    section: "A",
    createdBy: teacher._id,
  });
  student2 = await M.Student.create({
    uid: "ST2",
    name: "Other student",
    course: "CSE",
    section: "A",
    createdBy: teacher._id,
  });
  token = issueToken({ id: String(teacher._id), role: "TEACHER" });
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});
test("complete assessment lifecycle, authorization and concurrent event integrity", async () => {
  const login = await request(app)
    .post("/api/auth/teacher/login")
    .send({ email: "t@example.com", password: "longpassword123" });
  assert.equal(login.status, 200);
  const q = await M.Question.create({
    ...questionSchema.parse({
      title: "MCQ",
      question: "Choose A",
      type: "SINGLE",
      marks: 10,
      options: ["A", "B"],
      correctAnswer: [0],
    }),
    createdBy: teacher._id,
  });
  const coding = await M.Question.create({
    ...questionSchema.parse({
      title: "Code",
      type: "CODING",
      marks: 20,
      testCases: [
        {
          input: "secret-input",
          expectedOutput: "secret-output",
          hidden: true,
          weight: 1,
        },
      ],
    }),
    createdBy: teacher._id,
  });
  let r = await request(app)
    .post("/api/assessments")
    .set(auth(token))
    .send({
      title: "Test",
      type: "MIXED",
      duration: 30,
      questionIds: [String(q._id), String(coding._id)],
      securitySettings: {
        maxWarnings: 3,
        eventRules: {
          COPY_ATTEMPT: "WARNING",
          TAB_HIDDEN: "WARNING",
          WINDOW_BLUR: "WARNING",
        },
      },
    });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  a = r.body;
  r = await request(app)
    .post("/api/assessments/" + a._id + "/assign")
    .set(auth(token))
    .send({ studentIds: [String(student._id)] });
  assert.equal(r.status, 200);
  r = await request(app)
    .post("/api/assessments/" + a._id + "/access-code")
    .set(auth(token));
  assert.equal(r.status, 200);
  const code = r.body.accessCode;
  const otherToken = issueToken({ id: String(teacher2._id), role: "TEACHER" });
  assert.equal(
    (
      await request(app)
        .get("/api/assessments/" + a._id)
        .set(auth(otherToken))
    ).status,
    404,
  );
  assert.equal(
    (await request(app).post("/api/attempts/start").set(auth(token))).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/assessments/" + a._id + "/start")
        .set(auth(token))
    ).status,
    200,
  );
  r = await request(app)
    .post("/api/auth/student/login")
    .send({ uid: "ST2", assessmentId: a._id, accessCode: code });
  assert.equal(r.status, 401);
  r = await request(app)
    .post("/api/auth/student/login")
    .send({ uid: "ST1", assessmentId: a._id, accessCode: code });
  assert.equal(r.status, 200);
  studentToken = r.body.token;
  assert.equal(
    (await request(app).get("/api/students").set(auth(studentToken))).status,
    403,
  );
  r = await request(app).post("/api/attempts/start").set(auth(studentToken));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  attempt = r.body.attemptId;
  const second = await request(app)
    .post("/api/attempts/start")
    .set(auth(studentToken));
  assert.equal(second.body.attemptId, attempt);
  r = await request(app)
    .get("/api/attempts/" + attempt)
    .set(auth(studentToken));
  assert.equal(r.status, 200);
  assert.equal(JSON.stringify(r.body).includes("secret-input"), false);
  assert.equal(r.body.assessment.questions[0].correctAnswer, undefined);
  r = await request(app)
    .patch("/api/attempts/" + attempt + "/answers")
    .set(auth(studentToken))
    .send({ questionId: String(q._id), value: [0] });
  assert.equal(r.status, 200);
  const eid = crypto.randomUUID();
  const events = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .post("/api/proctor/events")
        .set(auth(studentToken))
        .send({ attemptId: attempt, eventId: eid, eventType: "COPY_ATTEMPT" }),
    ),
  );
  assert.ok(events.every((r) => r.status === 200));
  assert.equal((await M.Attempt.findById(attempt)).warningCount, 1);
  assert.equal(await M.ProctorEvent.countDocuments({ eventId: eid }), 1);
  for (const type of ["TAB_HIDDEN", "WINDOW_BLUR"]) {
    r = await request(app)
      .post("/api/proctor/events")
      .set(auth(studentToken))
      .send({
        attemptId: attempt,
        eventId: crypto.randomUUID(),
        eventType: type,
      });
    assert.equal(r.status, 200);
  }
  assert.equal((await M.Attempt.findById(attempt)).warningCount, 2);
  r = await request(app)
    .post("/api/proctor/events")
    .set(auth(studentToken))
    .send({
      attemptId: attempt,
      eventId: crypto.randomUUID(),
      eventType: "COPY_ATTEMPT",
    });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "SUBMITTED");
  assert.equal(
    (
      await request(app)
        .patch("/api/attempts/" + attempt + "/answers")
        .set(auth(studentToken))
        .send({ questionId: String(q._id), value: [1] })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/code/run")
        .set(auth(studentToken))
        .send({
          attemptId: attempt,
          questionId: String(coding._id),
          language: "python",
          code: "print(1)",
        })
    ).status,
    409,
  );
  const result = await M.Result.findOne({ attempt });
  assert.equal(result.quizScore, 10);
  assert.equal(
    (
      await request(app)
        .get("/api/results/mine/" + attempt)
        .set(auth(studentToken))
    ).body.result,
    null,
  );
  await request(app)
    .patch("/api/assessments/" + a._id + "/publish")
    .set(auth(token))
    .send({ publishResults: true });
  assert.equal(
    (
      await request(app)
        .get("/api/results/mine/" + attempt)
        .set(auth(studentToken))
    ).body.result.quizScore,
    10,
  );
});
test("expiration rejects mutations and submits saved answers", async () => {
  const fresh = await M.Assessment.create({
    ...a,
    _id: undefined,
    status: "LIVE",
    createdBy: teacher._id,
  });
  await M.AssessmentStudent.create({
    student: student._id,
    assessment: fresh._id,
  });
  const tok = issueToken({
    id: String(student._id),
    role: "STUDENT",
    assessmentId: String(fresh._id),
  });
  const r = await request(app).post("/api/attempts/start").set(auth(tok));
  assert.equal(r.status, 200);
  await M.Attempt.updateOne(
    { _id: r.body.attemptId },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  assert.equal(
    (
      await request(app)
        .post("/api/attempts/" + r.body.attemptId + "/submit")
        .set(auth(tok))
    ).status,
    409,
  );
  await expireAttempts();
  assert.equal((await M.Attempt.findById(r.body.attemptId)).status, "EXPIRED");
  assert.ok(await M.Result.exists({ attempt: r.body.attemptId }));
});
