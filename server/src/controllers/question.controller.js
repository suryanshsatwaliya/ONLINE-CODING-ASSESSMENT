import { Question } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { importLeetcodeProblem } from "../services/leetcodeImport.service.js";
import { execute, publicExecution } from "../services/codeRunner.service.js";
export async function importProblem(req, res) {
  res.json(await importLeetcodeProblem(req.body.reference));
}
export async function list(req, res) {
  if (req.query.summary === "true") {
    return res.json(await Question.find({ createdBy: req.user.id })
      .select("title question description type marks tags createdAt")
      .sort({ createdAt: -1 }).limit(2000).lean());
  }
  res.json(
    await Question.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .limit(2000),
  );
}
export async function getOne(req, res) {
  const question = await Question.findOne({ _id: req.params.id, createdBy: req.user.id });
  if (!question) throw new ApiError(404, "Question not found");
  res.json(question);
}
async function runSavedQuestion(question, req, res) {
  if (!question || question.type !== "CODING") throw new ApiError(404, "Coding question not found");
  const submit = req.body.submit === true;
  const completeProgram = question.executionConfig?.mode === "STDIO";
  const runHidden = submit && !completeProgram;
  const execution = await execute(question, req.body.code, req.body.language, false, { includeHidden: runHidden, sampleOnly: !runHidden });
  res.json(runHidden ? { status: "DONE", ...publicExecution(execution, true) } : execution);
}
export async function testRun(req, res) {
  const question = await Question.findOne({ _id: req.params.id, createdBy: req.user.id }).lean();
  await runSavedQuestion(question, req, res);
}
export async function create(req, res) {
  res
    .status(201)
    .json(await Question.create({ ...req.body, createdBy: req.user.id }));
}
export async function update(req, res) {
  const q = await Question.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    { $set: req.body },
    { new: true },
  );
  if (!q) throw new ApiError(404, "Question not found");
  res.json(q);
}
export async function remove(req, res) {
  const q = await Question.findOneAndDelete({
    _id: req.params.id,
    createdBy: req.user.id,
  });
  if (!q) throw new ApiError(404, "Question not found");
  res.json({ success: true });
}
export function reference(req, res) {
  res.json({
    source: "EXTERNAL",
    externalReference: String(req.query.reference || "").slice(0, 500),
    notice:
      "Reference recorded only. Supply your own permitted statement, examples and tests. No scraping is performed.",
  });
}
