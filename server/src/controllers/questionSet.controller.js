import mongoose from "mongoose";
import { QuestionSet } from "../models/index.js";
import ApiError from "../utils/ApiError.js";

function payload(body) {
  const questions = body.questions.map((q) => ({ ...q, _id: new mongoose.Types.ObjectId() }));
  return {
    title: body.title, description: body.description, type: body.type, questions,
    questionCount: questions.length,
    totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
    readyForAssessment: questions.every((q) => q.type !== "CODING" || q.testCases.some((t) => t.hidden)),
  };
}
export async function list(req, res) {
  res.json(await QuestionSet.find({ createdBy: req.user.id }).select("-questions").sort({ updatedAt: -1 }));
}
export async function get(req, res) {
  const set = await QuestionSet.findOne({ _id: req.params.id, createdBy: req.user.id });
  if (!set) throw new ApiError(404, "Question set not found");
  res.json(set);
}
export async function create(req, res) {
  res.status(201).json(await QuestionSet.create({ ...payload(req.body), createdBy: req.user.id }));
}
export async function update(req, res) {
  if (req.body.revision === undefined) throw new ApiError(422, "Reload this question set before saving");
  const set = await QuestionSet.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id, revision: req.body.revision },
    { $set: payload(req.body), $inc: { revision: 1 } }, { new: true },
  );
  if (!set) throw new ApiError(409, "This set was changed or removed. Reload it before saving again.");
  res.json(set);
}
export async function remove(req, res) {
  const set = await QuestionSet.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
  if (!set) throw new ApiError(404, "Question set not found");
  res.json({ success: true });
}
