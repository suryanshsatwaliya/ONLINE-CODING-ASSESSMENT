import { z } from "zod";
import { CodeSubmission, AIReview } from "../models/index.js";
import { ownAssessment } from "../services/assessment.service.js";
import { reviewCode } from "../services/aiGrading.service.js";
import { gradeAttempt } from "../services/grading.service.js";
import ApiError from "../utils/ApiError.js";
export async function create(req, res) {
  const s = await CodeSubmission.findById(req.params.id);
  if (!s) throw new ApiError(404, "Submission not found");
  const a = await ownAssessment(s.assessment, req.user);
  if (!a.aiEnabled || s.status !== "DONE")
    throw new ApiError(
      409,
      "Enable AI and complete deterministic grading first",
    );
  if (await AIReview.exists({ submission: s._id }))
    throw new ApiError(409, "Review already exists");
  const q = a.questions.find((q) => String(q._id) === s.questionId);
  const review = await reviewCode(q, s.code, s.language, a.aiRubric);
  res.json(
    await AIReview.create({
      submission: s._id,
      assessment: a._id,
      review,
      qualityScore: (q.qualityMarks * review.codeQuality) / 10,
      efficiencyScore: (q.efficiencyMarks * review.efficiency) / 10,
    }),
  );
}
export async function get(req, res) {
  const s = await CodeSubmission.findById(req.params.id);
  if (!s) throw new ApiError(404, "Submission not found");
  await ownAssessment(s.assessment, req.user);
  res.json(await AIReview.findOne({ submission: s._id }));
}
export async function approve(req, res) {
  const review = await AIReview.findById(req.params.id);
  if (!review) throw new ApiError(404, "Review not found");
  const a = await ownAssessment(review.assessment, req.user);
  const s = await CodeSubmission.findById(review.submission);
  const q = a.questions.find((q) => String(q._id) === s.questionId);
  const b = z
    .object({
      qualityScore: z.number().min(0).max(q.qualityMarks),
      efficiencyScore: z.number().min(0).max(q.efficiencyMarks),
      status: z.enum(["APPROVED", "REJECTED"]),
    })
    .parse(req.body);
  Object.assign(review, b, { reviewedBy: req.user.id });
  await review.save();
  await gradeAttempt(s.attempt);
  res.json(review);
}
