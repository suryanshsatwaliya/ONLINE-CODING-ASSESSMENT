import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  Assessment,
  AssessmentStudent,
  Attempt,
  Answer,
  ProctorEvent,
} from "../models/index.js";
import {
  studentQuestion,
  shuffled,
  withActive,
} from "../services/assessment.service.js";
import {
  closeAttempt,
  expireAttempts,
  endAssessmentIfDeadlineReached,
} from "../services/attemptLifecycle.service.js";
import { assessmentDeadline, assessmentAdmissionDeadline } from "../services/assessmentTiming.service.js";
import { startScheduledAssessments } from "../services/assessmentSchedule.service.js";
import { gradeAttempt } from "../services/grading.service.js";
import { emitAttempt } from "../services/realtime.service.js";
import ApiError from "../utils/ApiError.js";
export async function start(req, res) {
  await startScheduledAssessments(req.user.assessmentId);
  let t, a;
  await mongoose.connection.transaction(async (session) => {
    a = await Assessment.findOneAndUpdate(
      { _id: req.user.assessmentId, status: "LIVE" },
      { $inc: { revision: 1 } },
      { new: true, session },
    );
    if (!a) throw new ApiError(409, "Assessment has not started or has ended");
    const assignment = await AssessmentStudent.findOne({
        assessment: a._id,
        student: req.user.id,
      }).session(session);
    if (!assignment) throw new ApiError(403, "Not assigned");
    t = await Attempt.findOne({
      assessment: a._id,
      student: req.user.id,
    }).session(session);
    if (t?.status === "ACTIVE") {
      if (t.expiresAt <= new Date()) throw new ApiError(409, "Attempt time has expired");
      if (assignment.reentryAllowed) {
        assignment.reentryAllowed = false;
        await assignment.save({ session });
      }
      return;
    }
    if (t) throw new ApiError(409, "Assessment already submitted. Ask your teacher to restart your attempt.");
    if (assessmentAdmissionDeadline(a) <= Date.now() && !assignment.reentryAllowed)
      throw new ApiError(409, "Assessment has not started or has ended");
    const ids = a.questions.map((q) => String(q._id));
    const questionOrder = a.randomizeQuestions ? shuffled(ids) : ids;
    const now = new Date();
    [t] = await Attempt.create(
      [
        {
          student: req.user.id,
          assessment: a._id,
          startedAt: now,
          expiresAt: new Date(
            Math.min(
              +now + a.duration * 60000,
              assessmentDeadline(a),
            ),
          ),
          questionOrder,
          currentQuestionId: questionOrder[0],
          optionOrders: Object.fromEntries(
            a.questions.map((q) => [
              q._id,
              a.randomizeOptions
                ? shuffled(q.options.map((_, i) => i))
                : q.options.map((_, i) => i),
            ]),
          ),
          lastActivity: now,
        },
      ],
      { session },
    );
    await ProctorEvent.create(
      [
        {
          attemptId: t._id,
          studentId: t.student,
          assessmentId: a._id,
          eventId: randomUUID(),
          eventType: "ASSESSMENT_STARTED",
          timestamp: now,
          warningIssued: false,
          warningCountAfterEvent: 0,
        },
      ],
      { session },
    );
  });
  emitAttempt(a, t);
  res.json({ attemptId: t._id });
}
export async function get(req, res) {
  await expireAttempts();
  const t = await Attempt.findOne({
    _id: req.params.id,
    student: req.user.id,
    assessment: req.user.assessmentId,
  });
  if (!t) throw new ApiError(404, "Attempt not found");
  const a = await Assessment.findById(t.assessment);
  const safe = a.toObject();
  safe.questions = t.questionOrder
    .map((id) => a.questions.find((q) => String(q._id) === id))
    .filter(Boolean)
    .map(studentQuestion);
  res.json({ attempt: t, assessment: safe, serverTime: new Date() });
}
export async function save(req, res) {
  const { t, a } = await withActive(
    req.params.id,
    req.user,
    async (t, a, session) => {
      const q = a.questions.find((q) => String(q._id) === req.body.questionId);
      if (!q) throw new ApiError(422, "Question not in assessment");
      const v = req.body.value;
      if (q.type === "CODING") {
        if (
          !v ||
          typeof v !== "object" ||
          Array.isArray(v) ||
          !q.supportedLanguages.includes(v.language) ||
          typeof v.code !== "string"
        )
          throw new ApiError(422, "Invalid code draft");
      } else if (q.type === "SHORT") {
        if (typeof v !== "string") throw new ApiError(422, "Text required");
      } else if (
        !Array.isArray(v) ||
        v.some((i) => i < 0 || i >= q.options.length) ||
        new Set(v).size !== v.length ||
        (q.type !== "MULTIPLE" && v.length > 1)
      )
        throw new ApiError(422, "Invalid answer");
      t.answers = {
        ...t.answers,
        [req.body.questionId]: { value: v, marked: req.body.marked },
      };
      t.currentQuestionId = req.body.questionId;
      t.markModified("answers");
      await Answer.findOneAndUpdate(
        { attempt: t._id, questionId: req.body.questionId },
        { $set: { value: v, marked: req.body.marked } },
        { upsert: true, session },
      );
    },
  );
  emitAttempt(a, t);
  res.json({ savedAt: t.lastActivity });
}
export async function progress(req, res) {
  const body = z.object({ questionId: z.string().min(1).max(100) }).parse(req.body);
  const { t, a } = await withActive(req.params.id, req.user, async (t, a) => {
    if (!a.questions.some((question) => String(question._id) === body.questionId))
      throw new ApiError(422, "Question not in assessment");
    t.currentQuestionId = body.questionId;
  });
  emitAttempt(a, t);
  res.json({ questionId: t.currentQuestionId });
}
export async function submit(req, res) {
  const { t, a } = await withActive(
    req.params.id,
    req.user,
    async (t, a, session) => closeAttempt(t, a, "SUBMITTED", session),
  );
  await endAssessmentIfDeadlineReached(a._id);
  await gradeAttempt(t._id);
  emitAttempt(a, t);
  res.json({ status: t.status });
}
