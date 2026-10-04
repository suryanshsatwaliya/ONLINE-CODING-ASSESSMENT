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
  assert.match(code, /^[A-Z0-9]{6}$/);
  assert.match(code, /[A-Z]/);
  assert.match(code, /[0-9]/);
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
    .send({ uid: "ST2", accessCode: code });
  assert.equal(r.status, 401);
  r = await request(app)
    .post("/api/auth/student/login")
    .send({ uid: "ST1", accessCode: code });
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
const mcq = (title = "Choose A") => ({ title, question: title, type: "SINGLE", marks: 2, options: ["A", "B"], correctAnswer: [0] });
const codingQuestion = () => ({ title: "Double", type: "CODING", marks: 5, description: "Double an integer.", examples: [{ input: "2", output: "4", explanation: "Two doubled is four." }], testCases: [{ input: "3", expectedOutput: "6", hidden: true, weight: 1 }] });

test("question sets persist independently, are reusable, and preserve assessment snapshots across edits and deletion", async () => {
  const before = await M.Assessment.countDocuments();
  const body = { title: "Reusable quiz", description: "Two questions", type: "QUIZ", questions: [mcq("First"), mcq("Second")] };
  let response = await request(app).post("/api/question-sets").set(auth(token)).send(body);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const saved = response.body;
  assert.equal(saved.questionCount, 2);
  assert.equal(saved.totalMarks, 4);
  assert.equal(await M.Assessment.countDocuments(), before, "Saving a set must not create an assessment");
  assert.equal((await request(app).get("/api/question-sets/" + saved._id).set(auth(token))).body.questions[1].title, "Second");
  const listing = await request(app).get("/api/question-sets").set(auth(token));
  assert.ok(listing.body.some((set) => set._id === saved._id));
  assert.equal(listing.body.find((set) => set._id === saved._id).questions, undefined);
  const assessmentBody = { title: "Assessment A", type: "QUIZ", duration: 20, questionSetIds: [saved._id] };
  response = await request(app).post("/api/assessments").set(auth(token)).send(assessmentBody);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const exam = response.body;
  assert.equal(exam.questions.length, 2);
  assert.equal(exam.totalMarks, 4);
  response = await request(app).post("/api/assessments").set(auth(token)).send({ ...assessmentBody, title: "Assessment B" });
  assert.equal(response.status, 201);
  assert.notEqual(response.body._id, exam._id);
  response = await request(app).put("/api/question-sets/" + saved._id).set(auth(token)).send({ ...body, revision: saved.revision, questions: [mcq("Revised bank question")] });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal((await request(app).put("/api/question-sets/" + saved._id).set(auth(token)).send({ ...body, revision: saved.revision })).status, 409, "Stale edits cannot overwrite newer bank content");
  response = await request(app).put("/api/assessments/" + exam._id).set(auth(token)).send({ ...assessmentBody, duration: 45 });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.questions[0].title, "First");
  assert.equal(response.body.questions.length, 2);
  assert.equal((await M.QuestionSet.findById(saved._id)).questions[0].title, "Revised bank question");
  await request(app).delete("/api/question-sets/" + saved._id).set(auth(token));
  response = await request(app).put("/api/assessments/" + exam._id).set(auth(token)).send({ ...assessmentBody, duration: 35 });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.questions[0].title, "First");
  assert.equal((await request(app).post("/api/assessments").set(auth(token)).send(assessmentBody)).status, 422);
});

test("sets enforce teacher ownership, question types, grading readiness and total assessment size", async () => {
  const otherToken = issueToken({ id: String(teacher2._id), role: "TEACHER" });
  const body = { title: "Coding library", type: "CODING", questions: [codingQuestion(), codingQuestion()] };
  let response = await request(app).post("/api/question-sets").set(auth(token)).send(body);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const saved = response.body;
  assert.equal(saved.questions[0].examples[0].explanation, "Two doubled is four.");
  assert.equal((await request(app).get("/api/question-sets/" + saved._id).set(auth(otherToken))).status, 404);
  assert.equal((await request(app).delete("/api/question-sets/" + saved._id).set(auth(otherToken))).status, 404);
  assert.equal((await request(app).put("/api/question-sets/" + saved._id).set(auth(otherToken)).send({ ...body, revision: 0 })).status, 409);
  const exam = { title: "Coding exam", type: "CODING", duration: 30, questionSetIds: [saved._id] };
  assert.equal((await request(app).post("/api/assessments").set(auth(otherToken)).send(exam)).status, 422);
  assert.equal((await request(app).post("/api/assessments").set(auth(token)).send({ ...exam, type: "QUIZ" })).status, 422);
  assert.equal((await request(app).post("/api/assessments").set(auth(token)).send({ ...exam, questionSetIds: [saved._id, saved._id] })).status, 422);
  response = await request(app).post("/api/assessments").set(auth(token)).send(exam);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.totalMarks, 10);
  await M.Assessment.updateOne({ _id: response.body._id }, { status: "LIVE" });
  assert.equal((await request(app).put("/api/assessments/" + response.body._id).set(auth(token)).send(exam)).status, 409);
  const draft = await request(app).post("/api/question-sets").set(auth(token)).send({ ...body, questions: [{ ...codingQuestion(), testCases: [] }] });
  assert.equal(draft.status, 201);
  assert.equal(draft.body.readyForAssessment, false);
  assert.equal((await request(app).post("/api/assessments").set(auth(token)).send({ ...exam, questionSetIds: [draft.body._id] })).status, 422);
  const invalid = await request(app).post("/api/question-sets").set(auth(token)).send({ ...body, questions: [mcq()] });
  assert.equal(invalid.status, 422);
  assert.equal((await request(app).post("/api/assessments").set(auth(token)).send({ ...exam, newQuestions: [codingQuestion()] })).status, 422);
  for (const endpoint of ["/api/question-sets", "/api/questions/import/leetcode"]) {
    assert.equal((await request(app).post(endpoint).send(body)).status, 401);
    assert.equal((await request(app).post(endpoint).set(auth(studentToken)).send(body)).status, 403);
  }
  const large = await request(app).post("/api/question-sets").set(auth(token)).send({ title: "Large reusable set", type: "CODING", questions: Array.from({ length: 100 }, () => ({ ...codingQuestion(), description: "X".repeat(3000) })) });
  assert.equal(large.status, 201, JSON.stringify(large.body));
  assert.equal((await request(app).post("/api/assessments").set(auth(token)).send({ ...exam, questionSetIds: [large.body._id, saved._id] })).status, 422);
});

test("mixed set assessments retain answers and grading through the existing student lifecycle", async () => {
  const quiz = await request(app).post("/api/question-sets").set(auth(token)).send({ title: "Reusable graded quiz", type: "QUIZ", questions: [mcq()] });
  const coding = await request(app).post("/api/question-sets").set(auth(token)).send({ title: "Reusable coding", type: "CODING", questions: [codingQuestion()] });
  let response = await request(app).post("/api/assessments").set(auth(token)).send({ title: "Mixed exam", type: "MIXED", duration: 20, questionSetIds: [quiz.body._id, coding.body._id] });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const exam = response.body;
  assert.deepEqual(exam.questions.map((q) => q.type), ["SINGLE", "CODING"]);
  assert.equal(exam.totalMarks, 7);
  await request(app).post("/api/assessments/" + exam._id + "/assign").set(auth(token)).send({ studentIds: [String(student._id)] });
  await request(app).post("/api/assessments/" + exam._id + "/access-code").set(auth(token));
  assert.equal((await request(app).post("/api/assessments/" + exam._id + "/start").set(auth(token))).status, 200);
  const studentAuth = auth(issueToken({ id: String(student._id), role: "STUDENT", assessmentId: exam._id }));
  response = await request(app).post("/api/attempts/start").set(studentAuth);
  assert.equal(response.status, 200);
  const attemptId = response.body.attemptId;
  response = await request(app).get("/api/attempts/" + attemptId).set(studentAuth);
  assert.equal(response.status, 200);
  assert.equal(response.body.assessment.questions[0].correctAnswer, undefined);
  assert.deepEqual(response.body.assessment.questions[1].testCases, []);
  response = await request(app).patch("/api/attempts/" + attemptId + "/answers").set(studentAuth).send({ questionId: exam.questions[0]._id, value: [0] });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  response = await request(app).post("/api/attempts/" + attemptId + "/submit").set(studentAuth);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal((await M.Result.findOne({ attempt: attemptId })).quizScore, 2);
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


test("six-character codes resolve assessments, rotate safely and enforce assignment", async () => {
  const exam = await M.Assessment.create({ createdBy: teacher._id, title: "Code access", status: "SCHEDULED" });
  await M.AssessmentStudent.create({ assessment: exam._id, student: student._id });
  const route = `/api/assessments/${exam._id}/access-code`;
  const otherAuth = auth(issueToken({ id: String(teacher2._id), role: "TEACHER" }));
  assert.equal((await request(app).post(route).set(otherAuth)).status, 409);
  const first = await request(app).post(route).set(auth(token));
  assert.equal(first.status, 200);
  assert.match(first.body.accessCode, /^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/);
  assert.equal(first.body.assessmentId, undefined);
  const loginWith = (accessCode, uid = "ST1") => request(app).post("/api/auth/student/login").send({ uid, accessCode });
  const login = await loginWith(` ${first.body.accessCode.toLowerCase()} `);
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.user.assessmentId, String(exam._id));
  assert.equal((await loginWith(first.body.accessCode, "ST2")).status, 401);
    assert.equal((await loginWith("ABC")).status, 422);
    assert.equal((await loginWith("AB123")).status, 422);
    assert.equal((await loginWith("AB12345")).status, 422);
  const stored = await M.Assessment.findById(exam._id).select("+accessCodeKey +accessCodeHash");
  assert.notEqual(stored.accessCodeKey, first.body.accessCode);
  assert.equal(await bcrypt.compare(first.body.accessCode, stored.accessCodeHash), true);
  await assert.rejects(M.Assessment.create({ createdBy: teacher2._id, accessCodeKey: stored.accessCodeKey }), (e) => e.code === 11000);
  const detail = await request(app).get(`/api/assessments/${exam._id}`).set(auth(token));
  assert.equal(detail.body.accessCodeKey, undefined);
  assert.equal(detail.body.accessCodeHash, undefined);
  const second = await request(app).post(route).set(auth(token));
  assert.equal(second.status, 200);
  assert.notEqual(second.body.accessCode, first.body.accessCode);
  assert.equal((await loginWith(first.body.accessCode)).status, 401);
  assert.equal((await loginWith(second.body.accessCode)).status, 200);
  await M.Assessment.updateOne({ _id: exam._id }, { status: "DRAFT" });
  assert.equal((await loginWith(second.body.accessCode)).status, 401);
  await M.Assessment.updateOne({ _id: exam._id }, { status: "LIVE" });
  const liveCode = await request(app).post(route).set(auth(token));
  assert.equal(liveCode.status, 200);
  assert.equal((await loginWith(liveCode.body.accessCode)).status, 200);
  await M.Assessment.updateOne({ _id: exam._id }, { status: "ENDED" });
  assert.equal((await loginWith(liveCode.body.accessCode)).status, 401);
  assert.equal((await request(app).post(route).set(auth(token))).status, 409);
});

test("teachers can delete only their unstarted assessments and bank content survives", async () => {
  const question = await M.Question.create({ createdBy: teacher._id, title: "Reusable delete test", type: "SINGLE", marks: 1 });
  const savedSet = await M.QuestionSet.create({ createdBy: teacher._id, title: "Reusable set", type: "QUIZ", questions: [question.toObject()], questionCount: 1, totalMarks: 1 });
  const otherAuth = auth(issueToken({ id: String(teacher2._id), role: "TEACHER" }));
  for (const status of ["DRAFT", "SCHEDULED", "LIVE", "ENDED"]) {
    const exam = await M.Assessment.create({ createdBy: teacher._id, title: `Delete ${status}`, status, questions: [question.toObject()], questionSets: [{ setId: savedSet._id, title: savedSet.title, type: "QUIZ", questionCount: 1 }] });
    await M.AssessmentStudent.create({ assessment: exam._id, student: student._id });
    const route = `/api/assessments/${exam._id}`;
    assert.equal((await request(app).delete(route).set(otherAuth)).status, 404);
    const studentAuth = auth(issueToken({ id: String(student._id), role: "STUDENT", assessmentId: String(exam._id) }));
    assert.equal((await request(app).delete(route).set(studentAuth)).status, 403);
    const response = await request(app).delete(route).set(auth(token));
    const deletable = ["DRAFT", "SCHEDULED"].includes(status);
    assert.equal(response.status, deletable ? 204 : 409, JSON.stringify(response.body));
    assert.equal(!!(await M.Assessment.exists({ _id: exam._id })), !deletable);
    assert.equal(!!(await M.AssessmentStudent.exists({ assessment: exam._id })), !deletable);
    if (deletable) {
      assert.equal((await request(app).get(route).set(auth(token))).status, 404);
      assert.equal((await request(app).delete(route).set(auth(token))).status, 404);
      assert.equal((await request(app).get("/api/assessments").set(studentAuth)).status, 403);
    }
  }
  assert.ok(await M.Question.exists({ _id: question._id }));
  assert.ok(await M.QuestionSet.exists({ _id: savedSet._id }));
});

test("deletion rolls back if an assessment has attempts", async () => {
  const exam = await M.Assessment.create({ createdBy: teacher._id, title: "Protected history", status: "SCHEDULED" });
  await M.AssessmentStudent.create({ assessment: exam._id, student: student._id });
  const savedAttempt = await M.Attempt.create({ assessment: exam._id, student: student._id });
  const response = await request(app).delete(`/api/assessments/${exam._id}`).set(auth(token));
  assert.equal(response.status, 409);
  assert.ok(await M.Assessment.exists({ _id: exam._id }));
  assert.ok(await M.AssessmentStudent.exists({ assessment: exam._id }));
  assert.ok(await M.Attempt.exists({ _id: savedAttempt._id }));
});

test("concurrent start and deletion cannot both succeed", async () => {
  const exam = await M.Assessment.create({ createdBy: teacher._id, title: "Concurrent deletion", status: "SCHEDULED", duration: 10, questions: [{ title: "Question", marks: 1 }], accessCodeHash: "test-hash", accessCodeKey: "test-lookup" });
  await M.AssessmentStudent.create({ assessment: exam._id, student: student._id });
  const [deleted, started] = await Promise.all([
    request(app).delete(`/api/assessments/${exam._id}`).set(auth(token)),
    request(app).post(`/api/assessments/${exam._id}/start`).set(auth(token)),
  ]);
  assert.equal(Number(deleted.status === 204) + Number(started.status === 200), 1);
  const remaining = await M.Assessment.findById(exam._id);
  if (deleted.status === 204) {
    assert.equal(remaining, null);
    assert.equal(await M.AssessmentStudent.countDocuments({ assessment: exam._id }), 0);
    assert.equal(started.status, 404);
  } else {
    assert.equal(deleted.status, 409);
    assert.equal(remaining.status, "LIVE");
    assert.equal(await M.AssessmentStudent.countDocuments({ assessment: exam._id }), 1);
  }
});

async function automaticEndingFixture(assignedStudents = [student, student2], extra = {}) {
  const q = { ...questionSchema.parse(mcq("Auto-ending question")), _id: new mongoose.Types.ObjectId() };
  const exam = await M.Assessment.create({ createdBy: teacher._id, title: "Automatic ending", type: "QUIZ", duration: 10, totalMarks: q.marks, status: "LIVE", startedAt: new Date(), closesAt: new Date(Date.now() + 600000), questions: [q], ...extra });
  for (const s of assignedStudents) await M.AssessmentStudent.create({ assessment: exam._id, student: s._id });
  const studentAuth = (s) => auth(issueToken({ id: String(s._id), role: "STUDENT", assessmentId: String(exam._id) }));
  return { exam, q, studentAuth };
}

test("assessment ends after every assigned student submits, not only students who have joined", async () => {
  const { exam, studentAuth } = await automaticEndingFixture();
  const first = await request(app).post("/api/attempts/start").set(studentAuth(student));
  assert.equal(first.status, 200);
  assert.equal((await request(app).post(`/api/attempts/${first.body.attemptId}/submit`).set(studentAuth(student))).status, 200);
  assert.equal((await M.Assessment.findById(exam._id)).status, "LIVE");
  const second = await request(app).post("/api/attempts/start").set(studentAuth(student2));
  assert.equal(second.status, 200);
  assert.equal((await request(app).post(`/api/attempts/${second.body.attemptId}/submit`).set(studentAuth(student2))).status, 200);
  const finished = await M.Assessment.findById(exam._id);
  assert.equal(finished.status, "ENDED");
  assert.equal(finished.endReason, "ALL_FINISHED");
  assert.ok(finished.endedAt);
});

test("late joiners share the teacher deadline and expiry closes and grades saved coding work", async () => {
  const coding = { ...questionSchema.parse(codingQuestion()), _id: new mongoose.Types.ObjectId() };
  const { exam, studentAuth } = await automaticEndingFixture([student, student2], { type: "CODING", questions: [coding], totalMarks: coding.marks, startedAt: new Date(Date.now() - 540000), closesAt: new Date(Date.now() + 60000) });
  const started = await request(app).post("/api/attempts/start").set(studentAuth(student));
  assert.equal(started.status, 200);
  const attemptId = started.body.attemptId;
  const attempt = await M.Attempt.findById(attemptId);
  assert.equal(+attempt.expiresAt, +exam.closesAt);
  assert.ok(+attempt.expiresAt - Date.now() < 65000);
  await M.Attempt.updateOne({ _id: attemptId }, { answers: { [coding._id]: { value: { code: "print(6)", language: "python" } } } });
  await M.Assessment.updateOne({ _id: exam._id }, { closesAt: new Date(Date.now() - 1000) });
  assert.equal((await request(app).post("/api/attempts/start").set(studentAuth(student2))).status, 409);
  assert.equal((await request(app).post(`/api/attempts/${attemptId}/submit`).set(studentAuth(student))).status, 409);
  await expireAttempts();
  assert.equal((await M.Assessment.findById(exam._id)).endReason, "TIME_EXPIRED");
  assert.equal((await M.Attempt.findById(attemptId)).status, "EXPIRED");
  assert.equal(await M.CodeSubmission.countDocuments({ attempt: attemptId }), 1);
  assert.equal((await M.Result.findOne({ attempt: attemptId })).status, "PENDING");
  await expireAttempts();
  assert.equal(await M.CodeSubmission.countDocuments({ attempt: attemptId }), 1);
});

test("automatic ending handles no-shows, hard closing times and concurrent final submissions", async () => {
  const noShows = await automaticEndingFixture([student], { closesAt: new Date(Date.now() - 1000) });
  const hardClose = await automaticEndingFixture([student], { endTime: new Date(Date.now() - 1000) });
  await expireAttempts();
  assert.equal((await M.Assessment.findById(noShows.exam._id)).status, "ENDED");
  assert.equal((await M.Assessment.findById(hardClose.exam._id)).status, "ENDED");
  const { exam, studentAuth } = await automaticEndingFixture();
  const attempts = await Promise.all([student, student2].map((s) => request(app).post("/api/attempts/start").set(studentAuth(s))));
  const submitted = await Promise.all([student, student2].map((s, i) => request(app).post(`/api/attempts/${attempts[i].body.attemptId}/submit`).set(studentAuth(s))));
  assert.deepEqual(submitted.map((r) => r.status), [200, 200]);
  assert.equal((await M.Assessment.findById(exam._id)).endReason, "ALL_FINISHED");
  assert.equal(await M.Attempt.countDocuments({ assessment: exam._id, status: "ACTIVE" }), 0);
});

test("scheduled assessments calculate hard close on create and edit", async () => {
  const startTime = new Date(Date.now() + 3600000).toISOString();
  const body = { title: "Scheduled timing", type: "QUIZ", duration: 60, startTime, status: "DRAFT" };
  const created = await request(app).post("/api/assessments").set(auth(token)).send(body);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(+new Date(created.body.endTime), +new Date(startTime) + 3600000);
  const edited = await request(app).put(`/api/assessments/${created.body._id}`).set(auth(token)).send({ ...body, duration: 15, endTime: created.body.endTime });
  assert.equal(edited.status, 200);
  assert.equal(+new Date(edited.body.endTime), +new Date(startTime) + 900000);
});

test("scheduler starts only ready due assessments and preserves the scheduled deadline", async () => {
  const { startScheduledAssessments } = await import("../src/services/assessmentSchedule.service.js");
  const due = new Date(Date.now() - 60000);
  const fixture = async (extra = {}) => automaticEndingFixture([student], {
    status: "SCHEDULED", startTime: due, startedAt: null, closesAt: null,
    accessCodeHash: "test", accessCodeKey: new mongoose.Types.ObjectId().toString(), ...extra,
  });
  const ready = await fixture();
  const future = await fixture({ startTime: new Date(Date.now() + 600000) });
  const draft = await fixture({ status: "DRAFT" });
  const missingCode = await fixture({ accessCodeHash: null });
  const missingStudents = await fixture();
  await M.AssessmentStudent.deleteMany({ assessment: missingStudents.exam._id });
  await Promise.all([startScheduledAssessments(), startScheduledAssessments()]);
  const started = await M.Assessment.findById(ready.exam._id);
  assert.equal(started.status, "LIVE");
  assert.equal(+started.startedAt, +due);
  assert.equal(+started.closesAt, +due + 600000);
  assert.equal(started.revision, 1);
  for (const item of [future, missingCode, missingStudents])
    assert.equal((await M.Assessment.findById(item.exam._id)).status, "SCHEDULED");
  assert.equal((await M.Assessment.findById(draft.exam._id)).status, "DRAFT");
  const join = await request(app).post("/api/attempts/start").set(ready.studentAuth(student));
  assert.equal(join.status, 200);
  assert.equal(+(await M.Attempt.findById(join.body.attemptId)).expiresAt, +started.closesAt);
  const missed = await fixture({ startTime: new Date(Date.now() - 3600000) });
  await expireAttempts();
  assert.equal((await M.Assessment.findById(missed.exam._id)).status, "ENDED");
  assert.equal((await request(app).post("/api/attempts/start").set(missed.studentAuth(student))).status, 409);
});

test("student lobby opens a due schedule without waiting for a worker tick and exposes server time only", async () => {
  const { exam, studentAuth } = await automaticEndingFixture([student], {
    status: "SCHEDULED", startTime: new Date(Date.now() - 1000), startedAt: null, closesAt: null,
    accessCodeHash: "test", accessCodeKey: new mongoose.Types.ObjectId().toString(),
  });
  const response = await request(app).get(`/api/assessments/${exam._id}`).set(studentAuth(student));
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "LIVE");
  assert.ok(response.body.serverTime);
  assert.equal(response.body.questions, undefined);
  assert.equal(response.body.accessCodeHash, undefined);
  assert.equal(response.body.accessCodeKey, undefined);
  const other = auth(issueToken({ id: String(student2._id), role: "STUDENT", assessmentId: new mongoose.Types.ObjectId().toString() }));
  assert.equal((await request(app).get(`/api/assessments/${exam._id}`).set(other)).status, 403);
});
