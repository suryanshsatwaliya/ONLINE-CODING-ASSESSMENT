import {
  Attempt,
  Assessment,
  CodeSubmission,
  AIReview,
  Result,
} from "../models/index.js";
export const normalize = (s) =>
  String(s ?? "")
    .replace(/\r\n/g, "\n")
    .trimEnd();
export function quizGrade(q, value) {
  if (
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && !value.length)
  )
    return 0;
  const ok =
    q.type === "SHORT"
      ? String(value).trim().toLowerCase() ===
        String(q.correctAnswer).trim().toLowerCase()
      : Array.isArray(value) &&
        JSON.stringify([...new Set(value)].sort((a, b) => a - b)) ===
          JSON.stringify([...q.correctAnswer].sort((a, b) => a - b));
  return ok ? q.marks : -q.negativeMarks;
}
export function weightedScore(tests, results, marks) {
  const total = tests.reduce((s, t) => s + t.weight, 0);
  return total
    ? Math.round(
        ((marks *
          tests.reduce(
            (s, t, i) => s + (results[i]?.passed ? t.weight : 0),
            0,
          )) /
          total) *
          100,
      ) / 100
    : 0;
}
export async function gradeAttempt(id) {
  const t = await Attempt.findById(id);
  if (!t || t.status === "ACTIVE") return;
  const a = await Assessment.findById(t.assessment);
  let quizScore = 0,
    codingScore = 0,
    aiScore = 0,
    pending = false;
  for (const q of a.questions) {
    if (q.type !== "CODING") {
      quizScore += quizGrade(q, t.answers?.[q._id]?.value);
      continue;
    }
    const sub = await CodeSubmission.findOne({
      attempt: t._id,
      questionId: String(q._id),
    }).sort({ createdAt: -1, _id: -1 });
    if (sub) {
      if (sub.status !== "DONE") pending = true;
      else {
        codingScore += sub.score || 0;
        if (a.aiEnabled) {
          const review = await AIReview.findOne({
            submission: sub._id,
            status: "APPROVED",
          });
          if (review) aiScore += review.qualityScore + review.efficiencyScore;
        }
      }
    }
  }
  quizScore = Math.max(0, quizScore);
  const totalScore = quizScore + codingScore + aiScore;
  return Result.findOneAndUpdate(
    { attempt: t._id },
    {
      $set: {
        student: t.student,
        assessment: t.assessment,
        quizScore,
        codingScore,
        aiScore,
        totalScore,
        percentage: a.totalMarks ? (100 * totalScore) / a.totalMarks : 0,
        status: pending ? "PENDING" : "GRADED",
        gradedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
}
