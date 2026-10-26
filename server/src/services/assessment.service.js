import mongoose from "mongoose";
import { randomInt } from "node:crypto";
import {
  Assessment,
  Attempt,
  Student,
  AssessmentStudent,
} from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { assessmentDeadline } from "./assessmentTiming.service.js";
export const shuffled = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
export const studentQuestion = (q) => {
  const { correctAnswer, explanation, testCases, ...safe } = q;
  return {
    ...safe,
    examples: Array.isArray(safe.examples) ? safe.examples : [],
    starterCode: safe.starterCode && typeof safe.starterCode === "object" ? safe.starterCode : {},
    supportedLanguages: Array.isArray(safe.supportedLanguages) && safe.supportedLanguages.length
      ? safe.supportedLanguages
      : ["python"],
    testCases: (testCases || [])
      .filter((t) => !t.hidden)
      .map(({ input, expectedOutput }) => ({ input, expectedOutput })),
  };
};
export async function ownAssessment(id, user, session) {
  const a = await Assessment.findOne({ _id: id, createdBy: user.id }).session(
    session || null,
  );
  if (!a) throw new ApiError(404, "Assessment not found");
  return a;
}
// Every active-attempt mutation writes the assessment lock in the same transaction.
// Ending an assessment and concurrent saves cannot both commit in the wrong order.
export async function withActive(id, user, fn) {
  return mongoose.connection.transaction(async (session) => {
    let t = await Attempt.findOne({
      _id: id,
      student: user.id,
      assessment: user.assessmentId,
    }).session(session);
    if (!t) throw new ApiError(404, "Attempt not found");
    const a = await Assessment.findOneAndUpdate(
      { _id: t.assessment, status: "LIVE" },
      { $inc: { revision: 1 } },
      { new: true, session },
    );
    if (
      !a ||
      t.status !== "ACTIVE" ||
      t.expiresAt <= new Date() ||
      assessmentDeadline(a) <= Date.now()
    )
      throw new ApiError(409, "Attempt is closed or expired");
    if (
      !(await Student.exists({ _id: user.id, status: "ACTIVE" }).session(
        session,
      )) ||
      !(await AssessmentStudent.exists({
        student: user.id,
        assessment: a._id,
      }).session(session))
    )
      throw new ApiError(403, "Access revoked");
    t.lastActivity = new Date();
    t.revision++;
    const result = await fn(t, a, session);
    await t.save({ session });
    return { result, t, a };
  });
}
