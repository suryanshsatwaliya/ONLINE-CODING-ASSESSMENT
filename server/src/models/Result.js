import { model, Schema, ref } from "./shared.js";
export default model(
  "Result",
  {
    student: ref("Student"),
    assessment: ref("Assessment"),
    attempt: ref("Attempt"),
    quizScore: Number,
    codingScore: Number,
    aiScore: Number,
    totalScore: Number,
    percentage: Number,
    status: String,
    gradedAt: Date,
  },
  [[{ attempt: 1 }, { unique: true }]],
);
