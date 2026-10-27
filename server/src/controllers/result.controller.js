import {
  Result,
  Assessment,
  Attempt,
  CodeSubmission,
  AIReview,
  ExecutionResult,
} from "../models/index.js";
import { ownAssessment } from "../services/assessment.service.js";
import ApiError from "../utils/ApiError.js";
export async function list(req, res) {
  await ownAssessment(req.params.id, req.user);
  res.json(
    await Result.find({ assessment: req.params.id })
      .populate("student")
      .populate("attempt", "warningCount status submittedAt"),
  );
}
export async function mine(req, res) {
  const t = await Attempt.findOne({
    _id: req.params.id,
    student: req.user.id,
    assessment: req.user.assessmentId,
  });
  if (!t) throw new ApiError(404, "Attempt not found");
  const a = await Assessment.findById(t.assessment);
  res.json({
    status: t.status,
    terminationReason: t.terminationReason || null,
    published: a.publishResults,
    result: a.publishResults ? await Result.findOne({ attempt: t._id }) : null,
  });
}
export async function submissions(req, res) {
  const assessments = await Assessment.find({
    createdBy: req.user.id,
  }).distinct("_id");
  res.json(
    await CodeSubmission.find({ assessment: { $in: assessments } })
      .populate("student", "name uid")
      .sort({ createdAt: -1 })
      .limit(1000),
  );
}
export async function detail(req, res) {
  const t = await Attempt.findById(req.params.id).populate("student");
  if (!t) throw new ApiError(404, "Attempt not found");
  const assessment = await ownAssessment(t.assessment, req.user);
  const submissions = await CodeSubmission.find({ attempt: t._id });
  res.json({
    attempt: t,
    assessment,
    submissions,
    executions: await ExecutionResult.find({
      submission: { $in: submissions.map((s) => s._id) },
    }),
    reviews: await AIReview.find({
      submission: { $in: submissions.map((s) => s._id) },
    }),
  });
}
export async function retry(req, res) {
  const sub = await CodeSubmission.findById(req.params.id);
  if (!sub) throw new ApiError(404, "Submission not found");
  await ownAssessment(sub.assessment, req.user);
  if (sub.status !== "ERROR")
    throw new ApiError(409, "Only failed infrastructure jobs can be retried");
  sub.status = "QUEUED";
  sub.retries = 0;
  await sub.save();
  res.json(sub);
}
