import { Question } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
export async function list(req, res) {
  res.json(
    await Question.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .limit(2000),
  );
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
