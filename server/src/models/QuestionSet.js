import { model, Schema, ref } from "./shared.js";

export default model("QuestionSet", {
  createdBy: ref("Teacher"),
  title: String,
  description: String,
  type: String,
  questions: [Schema.Types.Mixed],
  questionCount: Number,
  totalMarks: Number,
  readyForAssessment: Boolean,
  revision: { type: Number, default: 0 },
}, [[{ createdBy: 1, updatedAt: -1 }, {}]]);
