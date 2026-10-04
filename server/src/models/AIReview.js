import { model, Schema, ref } from "./shared.js";
export default model(
  "AIReview",
  {
    submission: ref("CodeSubmission"),
    assessment: ref("Assessment"),
    review: Schema.Types.Mixed,
    generationStatus: { type: String, enum: ["QUEUED", "PROCESSING", "READY", "FAILED"], default: "QUEUED" },
    attempts: { type: Number, default: 0 },
    leaseUntil: Date,
    nextRetryAt: Date,
    error: String,
    modelName: String,
    generatedAt: Date,
    pdf: { type: Buffer, select: false },
    status: { type: String, default: "PENDING" },
    qualityScore: { type: Number, default: 0 },
    efficiencyScore: { type: Number, default: 0 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Teacher" },
  },
  [[{ submission: 1 }, { unique: true }]],
);
