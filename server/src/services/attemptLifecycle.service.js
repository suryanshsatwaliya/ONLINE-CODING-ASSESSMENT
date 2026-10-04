import mongoose from "mongoose";
import {
  Attempt,
  Assessment,
  CodeSubmission,
  ProctorEvent,
  AssessmentStudent,
} from "../models/index.js";
import { randomUUID } from "node:crypto";
import { gradeAttempt } from "./grading.service.js";
import { emitAttempt, emitAssessment } from "./realtime.service.js";
import { assessmentDeadline } from "./assessmentTiming.service.js";
import { startScheduledAssessments } from "./assessmentSchedule.service.js";
export async function closeAttempt(t, a, status, session) {
  t.status = status;
  t.submittedAt = new Date();
  if (status !== "TERMINATED") {
    for (const q of a.questions.filter((q) => q.type === "CODING")) {
      const value = t.answers?.[q._id]?.value;
      if (!value?.code || !q.supportedLanguages.includes(value.language))
        continue;
      const latest = await CodeSubmission.findOne({
        attempt: t._id,
        questionId: String(q._id),
      })
        .sort({ createdAt: -1, _id: -1 })
        .session(session);
      if (
        !latest ||
        latest.code !== value.code ||
        latest.language !== value.language
      )
        await CodeSubmission.create(
          [
            {
              attempt: t._id,
              assessment: a._id,
              student: t.student,
              questionId: String(q._id),
              code: value.code,
              language: value.language,
              status: "QUEUED",
            },
          ],
          { session },
        );
    }
  }
  await ProctorEvent.create(
    [
      {
        attemptId: t._id,
        studentId: t.student,
        assessmentId: a._id,
        eventId: randomUUID(),
        eventType:
          status === "TERMINATED"
            ? "ASSESSMENT_TERMINATED"
            : "ASSESSMENT_SUBMITTED",
        timestamp: new Date(),
        warningIssued: false,
        warningCountAfterEvent: t.warningCount,
      },
    ],
    { session },
  );
}
export async function finishAssessmentIfReady(id) {
  const closed = await mongoose.connection.transaction(async (session) => {
    let a = await Assessment.findOne({ _id: id, status: "LIVE" }).session(session);
    if (!a) return null;
    // Older running assessments did not record the teacher's start timestamp.
    if (!a.startedAt && a.duration > 0) {
      const first = await Attempt.findOne({ assessment: a._id }).sort({ startedAt: 1 }).session(session);
      a.startedAt = first?.startedAt || a.updatedAt;
      a.closesAt = new Date(assessmentDeadline(a));
      await a.save({ session });
    }
    const timedOut = assessmentDeadline(a) <= Date.now();
    if (!timedOut) {
      const assigned = await AssessmentStudent.find({ assessment: a._id }).select("student").session(session);
      if (!assigned.length) return null;
      const finished = await Attempt.countDocuments({ assessment: a._id, student: { $in: assigned.map((row) => row.student) }, status: { $in: ["SUBMITTED", "EXPIRED", "TERMINATED"] } }).session(session);
      if (finished !== assigned.length || await Attempt.exists({ assessment: a._id, status: "ACTIVE" }).session(session)) return null;
    }
    // This write serializes automatic ending with saves, starts and submissions.
    a = await Assessment.findOneAndUpdate({ _id: a._id, status: "LIVE" }, {
      $set: { status: "ENDED", endedAt: new Date(), endReason: timedOut ? "TIME_EXPIRED" : "ALL_FINISHED" },
      $inc: { revision: 1 },
    }, { session, new: true });
    const attempts = await Attempt.find({ assessment: a._id, status: "ACTIVE" }).session(session);
    for (const t of attempts) {
      await closeAttempt(t, a, "EXPIRED", session);
      await t.save({ session });
    }
    return { a, attempts };
  });
  if (closed) {
    emitAssessment(closed.a, "ASSESSMENT_ENDED", { assessmentId: closed.a._id, reason: closed.a.endReason });
    for (const t of closed.attempts) {
      emitAttempt(closed.a, t);
      await gradeAttempt(t._id);
    }
  }
  return closed?.a || null;
}
export async function expireAttempts() {
  await startScheduledAssessments();
  const now = new Date();
  const live = await Assessment.find({ status: "LIVE" }).select("_id");
  for (const a of live) await finishAssessmentIfReady(a._id);
  const endedIds = await Assessment.find({ status: "ENDED" }).distinct("_id");
  const candidates = await Attempt.find({
    status: "ACTIVE",
    $or: [{ expiresAt: { $lte: now } }, { assessment: { $in: endedIds } }],
  }).limit(100);
  for (const candidate of candidates) {
    let out;
    await mongoose.connection.transaction(async (session) => {
      out = null;
      const t = await Attempt.findOne({
        _id: candidate._id,
        status: "ACTIVE",
      }).session(session);
      if (!t) return;
      const a = await Assessment.findOneAndUpdate(
        { _id: t.assessment },
        { $inc: { revision: 1 } },
        { session, new: true },
      );
      if (!a || (a.status === "LIVE" && t.expiresAt > new Date() && assessmentDeadline(a) > Date.now())) return;
      await closeAttempt(t, a, "EXPIRED", session);
      await t.save({ session });
      out = { t, a };
    });
    if (out) {
      await gradeAttempt(out.t._id);
      emitAttempt(out.a, out.t);
      await finishAssessmentIfReady(out.a._id);
    }
  }
}
