import { model, Schema, ref } from "./shared.js";
export default model(
  "CodeSubmission",
  {
    attempt: ref("Attempt"),
    assessment: ref("Assessment"),
    student: ref("Student"),
    questionId: String,
    language: String,
    code: String,
    status: { type: String, default: "QUEUED" },
    score: Number,
    error: String,
    leaseUntil: Date,
    retries: { type: Number, default: 0 },
    version: Number,
  },
  [],
);
