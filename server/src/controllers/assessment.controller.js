import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { generateAssessmentCode, assessmentCodeKey } from "../services/assessmentCode.service.js";
import { z } from "zod";
import {
  Assessment,
  Question,
  QuestionSet,
  Student,
  AssessmentStudent,
  Attempt,
  ProctorEvent,
  Answer,
  CodeSubmission,
  AIReview,
  Result,
} from "../models/index.js";
import { ownAssessment } from "../services/assessment.service.js";
import { emitAssessment } from "../services/realtime.service.js";
import { closeAttempt } from "../services/attemptLifecycle.service.js";
import { gradeAttempt } from "../services/grading.service.js";
import ApiError from "../utils/ApiError.js";
import { startScheduledAssessments } from "../services/assessmentSchedule.service.js";
import { assessmentDeadline } from "../services/assessmentTiming.service.js";
import { emitAttempt } from "../services/realtime.service.js";
async function payload(body, user, previous = null) {
  const qs = await Question.find({
    _id: { $in: body.questionIds },
    createdBy: user.id,
  }).lean();
  const questions = body.questionIds.map((id) => {
    const q = previous?.questions.find((q) => !q.sourceSetId && String(q._id) === id)
      || qs.find((q) => String(q._id) === id);
    if (!q) throw new ApiError(422, "Question unavailable");
    return q;
  });
  if (new Set(body.questionIds).size !== body.questionIds.length)
    throw new ApiError(422, "Duplicate questions");
  const sets = await QuestionSet.find({ _id: { $in: body.questionSetIds }, createdBy: user.id }).lean();
  const questionSets = [];
  for (const id of body.questionSetIds) {
    const snapshot = previous?.questionSets?.find((set) => String(set.setId) === id);
    if (snapshot) {
      // Editing settings never silently replaces the saved assessment's questions.
      questions.push(...previous.questions.filter((q) => String(q.sourceSetId) === id));
      questionSets.push({ setId: snapshot.setId, title: snapshot.title, type: snapshot.type, questionCount: snapshot.questionCount });
    } else {
      const set = sets.find((set) => String(set._id) === id);
      if (!set) throw new ApiError(422, "A selected question set is unavailable");
      if (!set.readyForAssessment) throw new ApiError(422, `${set.title}: add hidden grading tests in the Question Bank before using this set.`);
      questions.push(...set.questions.map((q) => ({ ...q, sourceSetId: set._id })));
      questionSets.push({ setId: set._id, title: set.title, type: set.type, questionCount: set.questionCount });
    }
  }
  if (questions.length > 100) throw new ApiError(422, "An assessment can contain at most 100 questions");
  if (
    questions.some((q) =>
      body.type === "QUIZ"
        ? q.type === "CODING"
        : body.type === "CODING"
          ? q.type !== "CODING"
          : false,
    )
  )
    throw new ApiError(422, "Question types do not match assessment type");
  const { questionIds, questionSetIds, newQuestions, ...rest } = body;
  return {
    ...rest,
    endTime: body.startTime ? new Date(+new Date(body.startTime) + body.duration * 60000) : body.endTime,
    questions,
    questionSets,
    totalMarks: questions.reduce(
      (s, q) =>
        s +
        q.marks +
        (body.aiEnabled && q.type === "CODING"
          ? q.qualityMarks + q.efficiencyMarks
          : 0),
      0,
    ),
  };
}
export async function list(req, res) {
  if (req.user.role === "TEACHER")
    return res.json(
      await Assessment.find({ createdBy: req.user.id })
        .select("-questions")
        .sort({ createdAt: -1 }),
    );
  const a = await Assessment.findById(req.user.assessmentId).select(
    "-questions",
  );
  res.json(a ? [a] : []);
}
export async function get(req, res) {
  if (req.user.role === "TEACHER")
    return res.json(await ownAssessment(req.params.id, req.user));
  if (req.params.id !== req.user.assessmentId)
    throw new ApiError(403, "Access denied");
  await startScheduledAssessments(req.params.id);
  const assessment = await Assessment.findById(req.params.id).select("-questions");
  if (!assessment) throw new ApiError(404, "Assessment not found");
  res.json({ ...assessment.toObject(), serverTime: new Date() });
}
export async function create(req, res) {
  res.status(201).json(await Assessment.create({
    ...(await payload(req.body, req.user)), createdBy: req.user.id,
  }));
}
export async function reuse(req, res) {
  const source = await ownAssessment(req.params.id, req.user);
  if (source.status !== "ENDED")
    throw new ApiError(409, "Only completed assessments can be reused.");
  res.status(201).json(await Assessment.create({
    ...(await payload(req.body, req.user, source)),
    createdBy: req.user.id,
  }));
}
export async function update(req, res) {
  const previous = await ownAssessment(req.params.id, req.user);
  const p = await payload(req.body, req.user, previous);
  const assessment = await Assessment.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id, revision: previous.revision, status: { $in: ["DRAFT", "SCHEDULED"] } },
    { $set: p, $inc: { revision: 1 } }, { new: true },
  );
  if (!assessment) throw new ApiError(409, "This assessment changed or is locked. Reload before editing.");
  res.json(assessment);
}
export async function remove(req, res) {
  await mongoose.connection.transaction(async (session) => {
    // Deletion and starting an assessment contend on the same document.
    const assessment = await Assessment.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id,
      status: { $in: ["DRAFT", "SCHEDULED"] },
    }).session(session);
    if (!assessment) {
      await ownAssessment(req.params.id, req.user, session);
      throw new ApiError(409, "Only draft and scheduled assessments can be deleted.");
    }
    if (await Attempt.exists({ assessment: assessment._id }).session(session))
      throw new ApiError(409, "An assessment with student attempts cannot be deleted.");
    await AssessmentStudent.deleteMany({ assessment: assessment._id }).session(session);
  });
  res.status(204).end();
}
export async function assign(req, res) {
  const body = z
    .object({
      studentIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).default([]),
      course: z.string().optional(),
      section: z.string().optional(),
    })
    .parse(req.body);
  let count = 0;
  await mongoose.connection.transaction(async (session) => {
    const a = await Assessment.findOneAndUpdate(
      {
        _id: req.params.id,
        createdBy: req.user.id,
        status: { $in: ["DRAFT", "SCHEDULED"] },
      },
      { $inc: { revision: 1 } },
      { session, new: true },
    );
    if (!a)
      throw new ApiError(
        409,
        "Assignment requires a draft or scheduled assessment",
      );
    const filters = [
      ...(body.studentIds.length ? [{ _id: { $in: body.studentIds } }] : []),
      ...(body.course || body.section
        ? [
            {
              ...(body.course ? { course: body.course } : {}),
              ...(body.section ? { section: body.section } : {}),
            },
          ]
        : []),
    ];
    const students = filters.length
      ? await Student.find({ createdBy: req.user.id, $or: filters }).session(
          session,
        )
      : [];
    await AssessmentStudent.deleteMany({ assessment: a._id }).session(session);
    if (students.length)
      await AssessmentStudent.insertMany(
        students.map((s) => ({ assessment: a._id, student: s._id })),
        { session },
      );
    count = students.length;
  });
  res.json({ assigned: count });
}
export async function assignments(req, res) {
  await ownAssessment(req.params.id, req.user);
  res.json(
    await AssessmentStudent.find({ assessment: req.params.id }).populate(
      "student",
    ),
  );
}
export async function accessCode(req, res) {
  await Assessment.init();
  const previous = await Assessment.findOne({ _id: req.params.id, createdBy: req.user.id, status: { $in: ["DRAFT", "SCHEDULED", "LIVE"] } }).select("+accessCodeKey");
  if (!previous) throw new ApiError(409, "Codes can only be generated for draft, scheduled or live assessments");
  for (let retry = 0; retry < 5; retry++) {
    const code = generateAssessmentCode();
    if (assessmentCodeKey(code) === previous.accessCodeKey) continue;
    const hash = await bcrypt.hash(code, 12);
    try {
      const a = await Assessment.findOneAndUpdate(
        { _id: req.params.id, createdBy: req.user.id, status: { $in: ["DRAFT", "SCHEDULED", "LIVE"] } },
        { $set: { accessCodeHash: hash, accessCodeKey: assessmentCodeKey(code) } },
      );
      if (!a) throw new ApiError(409, "Codes can only be generated for draft, scheduled or live assessments");
      return res.json({ accessCode: code });
    } catch (error) {
      if (error.code !== 11000 || !error.keyPattern?.accessCodeKey) throw error;
    }
  }
  throw new ApiError(503, "Could not generate a unique code. Please try again.");
}
export async function start(req, res) {
  let a;
  await mongoose.connection.transaction(async (session) => {
    a = await ownAssessment(req.params.id, req.user, session);
    if (
      !["DRAFT", "SCHEDULED"].includes(a.status) ||
      !a.questions.length ||
      !(await Assessment.findById(a._id)
        .select("+accessCodeHash +accessCodeKey")
        .session(session)
        .then((x) => x.accessCodeHash && x.accessCodeKey)) ||
      !(await AssessmentStudent.exists({ assessment: a._id }).session(session))
    )
      throw new ApiError(
        409,
        "Add questions, assign students and generate an access code first",
      );
    if (a.startTime && a.startTime > new Date())
      throw new ApiError(409, "Scheduled start time has not arrived");
    if (a.endTime && a.endTime <= new Date())
      throw new ApiError(409, "End time has passed");
    a.status = "LIVE";
    a.startedAt = a.startTime || new Date();
    a.closesAt = new Date(Math.min(+a.startedAt + a.duration * 60000, a.endTime ? +a.endTime : Infinity));
    a.admissionClosesAt = a.closesAt;
    a.revision++;
    await a.save({ session });
  });
  emitAssessment(a, "ASSESSMENT_STARTED", { assessmentId: a._id });
  res.json(a);
}
export async function end(req, res) {
  let a,
    ids = [];
  await mongoose.connection.transaction(async (session) => {
    a = await ownAssessment(req.params.id, req.user, session);
    if (a.status !== "LIVE") throw new ApiError(409, "Assessment is not live");
    a.status = "ENDED";
    a.endedAt = new Date();
    a.endReason = "TEACHER";
    a.revision++;
    await a.save({ session });
    const ts = await Attempt.find({
      assessment: a._id,
      status: "ACTIVE",
    }).session(session);
    ids = [];
    for (const t of ts) {
      await closeAttempt(t, a, "SUBMITTED", session);
      await t.save({ session });
      ids.push(t._id);
    }
  });
  for (const id of ids) await gradeAttempt(id);
  emitAssessment(a, "ASSESSMENT_ENDED", { assessmentId: a._id });
  res.json(a);
}
export async function publish(req, res) {
  const { publishResults } = z
    .object({ publishResults: z.boolean() })
    .parse(req.body);
  const a = await ownAssessment(req.params.id, req.user);
  a.publishResults = publishResults;
  await a.save();
  res.json(a);
}
export async function monitor(req, res) {
  const assessment = await ownAssessment(req.params.id, req.user);
  const assignments = await AssessmentStudent.find({
    assessment: req.params.id,
  }).populate("student");
  const attempts = await Attempt.find({ assessment: req.params.id }).select(
    "-answers",
  );
  const latestEvents = await ProctorEvent.aggregate([
    { $match: { assessmentId: assessment._id } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: "$attemptId",
        eventType: { $first: "$eventType" },
        timestamp: { $first: "$timestamp" },
      },
    },
  ]);
  res.json(
    assignments
      .filter((x) => x.student)
      .map((x) => ({
        student: x.student,
        maxWarnings: assessment.securitySettings.maxWarnings,
        lastEvent:
          latestEvents.find(
            (e) =>
              String(e._id) ===
              String(
                attempts.find(
                  (t) => String(t.student) === String(x.student._id),
                )?._id,
              ),
          ) || null,
        attempt:
          attempts.find((t) => String(t.student) === String(x.student._id)) ||
          null,
      })),
  );
}

const minuteMs = 60000;
function setAssessmentDeadline(a, deadline) {
  const target = new Date(deadline);
  if (!a.startedAt) a.startedAt = new Date();
  a.duration = Math.max(a.duration || 1, Math.ceil((+target - +new Date(a.startedAt)) / minuteMs));
  a.closesAt = target;
  if (a.endTime) a.endTime = target;
}

export async function extendMonitorTime(req, res) {
  const body = z.object({
    minutes: z.number().int().min(1).max(480),
    scope: z.enum(["ASSESSMENT", "STUDENTS"]),
    studentIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(500).default([]),
  }).parse(req.body);
  if (body.scope === "STUDENTS" && !body.studentIds.length)
    throw new ApiError(422, "Select at least one student to add time.");

  let out;
  await mongoose.connection.transaction(async (session) => {
    const a = await Assessment.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.id, status: "LIVE" },
      { $inc: { revision: 1 } },
      { session, new: true },
    );
    if (!a) throw new ApiError(409, "Time can only be adjusted while the assessment is live.");
    const now = Date.now();
    const ms = body.minutes * minuteMs;
    const oldDeadline = assessmentDeadline(a);
    const baseAdmission = +(a.admissionClosesAt || new Date(oldDeadline));
    let attempts;
    let deadline;

    if (body.scope === "ASSESSMENT") {
      deadline = Math.max(oldDeadline, now) + ms;
      a.admissionClosesAt = new Date(Math.max(baseAdmission, now) + ms);
      attempts = await Attempt.find({ assessment: a._id, status: "ACTIVE" }).session(session);
      for (const attempt of attempts) {
        // Move every active attempt forward by the same amount, preserving any
        // individual extension it already has beyond the shared deadline.
        attempt.expiresAt = new Date(Math.max(+attempt.expiresAt, now) + ms);
        attempt.revision++;
        await attempt.save({ session });
      }
    } else {
      a.admissionClosesAt ||= new Date(oldDeadline);
      attempts = await Attempt.find({
        assessment: a._id,
        student: { $in: body.studentIds },
        status: "ACTIVE",
      }).session(session);
      if (!attempts.length) throw new ApiError(409, "None of the selected students has an active attempt.");
      for (const attempt of attempts) {
        attempt.expiresAt = new Date(Math.max(+attempt.expiresAt, now) + ms);
        attempt.revision++;
        await attempt.save({ session });
      }
      // Individual accommodations change only the selected attempt clocks.
      deadline = oldDeadline;
    }

    if (body.scope === "ASSESSMENT") setAssessmentDeadline(a, deadline);
    await a.save({ session });
    out = { assessment: a, count: attempts.length, deadline: a.closesAt };
  });
  emitAssessment(out.assessment, "ASSESSMENT_TIME_UPDATED", { assessmentId: out.assessment._id });
  res.json({ updatedAttempts: out.count, deadline: out.deadline });
}

export async function restartStudentAttempt(req, res) {
  const { mode } = z.object({ mode: z.enum(["BEGINNING", "CONTINUE"]) }).parse(req.body);
  let out;
  await mongoose.connection.transaction(async (session) => {
    const a = await Assessment.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.id, status: { $in: ["LIVE", "ENDED"] } },
      { $inc: { revision: 1 } },
      { session, new: true },
    );
    if (!a) throw new ApiError(409, "This assessment cannot be restarted in its current state.");
    const assignment = await AssessmentStudent.findOne({ assessment: a._id, student: req.params.studentId }).session(session);
    if (!assignment) throw new ApiError(404, "Student is not assigned to this assessment.");
    const attempt = await Attempt.findOne({ assessment: a._id, student: req.params.studentId }).session(session);
    if (!attempt) throw new ApiError(409, "This student has not started an attempt yet.");
    if (attempt.status === "ACTIVE") throw new ApiError(409, "This student's attempt is already active.");

    const now = new Date();
    const currentDeadline = assessmentDeadline(a);
    if (!Number.isFinite(currentDeadline) || currentDeadline <= +now)
      throw new ApiError(409, "The assessment deadline has passed. There is no time remaining for a restart.");
    const reopening = a.status === "ENDED";
    if (reopening) {
      a.status = "LIVE";
      a.endedAt = undefined;
      a.endReason = undefined;
      // Keep the original assessment deadline. A restart is only given the
      // time still left on the assessment clock, never a fresh duration.
      a.admissionClosesAt = new Date(+now - 1000);
    } else {
      a.admissionClosesAt ||= new Date(currentDeadline);
    }

    const restartDeadline = assessmentDeadline(a);
    if (!Number.isFinite(restartDeadline) || restartDeadline <= +now)
      throw new ApiError(409, "Could not determine the assessment's remaining time.");
    const expiresAt = new Date(restartDeadline);
    assignment.reentryAllowed = true;
    await assignment.save({ session });

    if (mode === "BEGINNING") {
      const submissions = await CodeSubmission.find({ attempt: attempt._id }).select("_id").session(session);
      await AIReview.deleteMany({ submission: { $in: submissions.map((submission) => submission._id) } }, { session });
      await CodeSubmission.deleteMany({ attempt: attempt._id }, { session });
      await Answer.deleteMany({ attempt: attempt._id }, { session });
      attempt.answers = {};
      attempt.warningCount = 0;
      attempt.lastWarningAt = undefined;
      attempt.lastWarningGroup = undefined;
      attempt.currentQuestionId = attempt.questionOrder?.[0];
    }
    await Result.deleteOne({ attempt: attempt._id }, { session });
    attempt.status = "ACTIVE";
    attempt.startedAt = now;
    attempt.expiresAt = expiresAt;
    attempt.submittedAt = undefined;
    attempt.terminationReason = undefined;
    attempt.lastActivity = now;
    attempt.revision++;
    await attempt.save({ session });
    await ProctorEvent.create([{
      attemptId: attempt._id,
      studentId: attempt.student,
      assessmentId: a._id,
      eventId: randomUUID(),
      eventType: "TEACHER_RESTARTED_ATTEMPT",
      timestamp: now,
      warningIssued: false,
      warningCountAfterEvent: attempt.warningCount,
      metadata: { mode },
    }], { session });
    await a.save({ session });
    out = { assessment: a, attempt };
  });
  emitAssessment(out.assessment, "ASSESSMENT_REOPENED", { assessmentId: out.assessment._id });
  emitAttempt(out.assessment, out.attempt);
  res.json({ status: out.attempt.status, expiresAt: out.attempt.expiresAt, mode });
}

export async function eventLog(req, res) {
  const t = await Attempt.findById(req.params.id);
  if (!t) throw new ApiError(404, "Attempt unavailable");
  await ownAssessment(t.assessment, req.user);
  res.json(
    await ProctorEvent.find({ attemptId: t._id })
      .sort({ timestamp: 1 })
      .limit(5000),
  );
}
