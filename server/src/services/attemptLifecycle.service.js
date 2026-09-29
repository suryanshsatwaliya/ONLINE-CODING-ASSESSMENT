import mongoose from "mongoose";
import {
  Attempt,
  Assessment,
  CodeSubmission,
  ProctorEvent,
} from "../models/index.js";
import { randomUUID } from "node:crypto";
import { gradeAttempt } from "./grading.service.js";
import { emitAttempt } from "./realtime.service.js";
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
export async function expireAttempts() {
  const now = new Date();
  const ended = await Assessment.find({
    status: "LIVE",
    endTime: { $lte: now },
  });
  for (const a of ended)
    await Assessment.updateOne(
      { _id: a._id, status: "LIVE" },
      { $set: { status: "ENDED" }, $inc: { revision: 1 } },
    );
  const endedIds = await Assessment.find({ status: "ENDED" }).distinct("_id");
  const candidates = await Attempt.find({
    status: "ACTIVE",
    $or: [{ expiresAt: { $lte: now } }, { assessment: { $in: endedIds } }],
  }).limit(100);
  for (const candidate of candidates) {
    let out;
    await mongoose.connection.transaction(async (session) => {
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
      await closeAttempt(t, a, "EXPIRED", session);
      await t.save({ session });
      out = { t, a };
    });
    if (out) {
      await gradeAttempt(out.t._id);
      emitAttempt(out.a, out.t);
    }
  }
}
