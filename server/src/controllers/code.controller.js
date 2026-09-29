import {
  CodeSubmission,
  ExecutionResult,
  Attempt,
  Assessment,
} from "../models/index.js";
import {
  execute,
  publicExecution,
  languages,
} from "../services/codeRunner.service.js";
import { withActive } from "../services/assessment.service.js";
import ApiError from "../utils/ApiError.js";
export const languageList = (req, res) => res.json(Object.keys(languages));
async function reserve(req, submit) {
  return withActive(req.body.attemptId, req.user, async (t, a, session) => {
    const q = a.questions.find(
      (q) => String(q._id) === req.body.questionId && q.type === "CODING",
    );
    if (
      !q ||
      !q.supportedLanguages.includes(req.body.language) ||
      !languages[req.body.language]
    )
      throw new ApiError(422, "Unsupported question or language");
    if (a.maxCodeRuns && t.codeRuns >= a.maxCodeRuns)
      throw new ApiError(429, "Code execution limit reached");
    t.codeRuns++;
    if (!submit) return q;
    if (
      await CodeSubmission.exists({
        attempt: t._id,
        questionId: String(q._id),
        status: { $in: ["QUEUED", "RUNNING"] },
      }).session(session)
    )
      throw new ApiError(
        409,
        "A submission for this question is still running",
      );
    t.answers = {
      ...t.answers,
      [q._id]: {
        value: { code: req.body.code, language: req.body.language },
        marked: false,
      },
    };
    t.markModified("answers");
    const [sub] = await CodeSubmission.create(
      [
        {
          attempt: t._id,
          assessment: a._id,
          student: t.student,
          questionId: String(q._id),
          code: req.body.code,
          language: req.body.language,
        },
      ],
      { session },
    );
    return sub;
  });
}
export async function run(req, res) {
  const { result: q } = await reserve(req, false);
  res.json(
    publicExecution(
      await execute(q, req.body.code, req.body.language, false),
      false,
    ),
  );
}
export async function submit(req, res) {
  const { result } = await reserve(req, true);
  res.status(202).json({ submissionId: result._id, status: result.status });
}
export async function get(req, res) {
  const s = await CodeSubmission.findOne({
    _id: req.params.id,
    student: req.user.id,
    assessment: req.user.assessmentId,
  });
  if (!s) throw new ApiError(404, "Submission not found");
  const result = await ExecutionResult.findOne({ submission: s._id });
  res.json({
    status: s.status,
    error: s.error,
    ...(result ? publicExecution(result, true) : {}),
  });
}
