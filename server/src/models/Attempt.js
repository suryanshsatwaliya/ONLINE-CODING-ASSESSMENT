import { model, Schema, ref } from "./shared.js";
export default model(
  "Attempt",
  {
    student: ref("Student"),
    assessment: ref("Assessment"),
    status: { type: String, default: "ACTIVE" },
    startedAt: Date,
    expiresAt: Date,
    submittedAt: Date,
    warningCount: { type: Number, default: 0 },
    terminationReason: String,
    lastWarningAt: Date,
    lastWarningGroup: String,
    answers: { type: Schema.Types.Mixed, default: {} },
    questionOrder: [String],
    optionOrders: Schema.Types.Mixed,
    lastActivity: Date,
    connected: { type: Boolean, default: false },
    codeRuns: { type: Number, default: 0 },
    revision: { type: Number, default: 0 },
  },
  [[{ assessment: 1, student: 1 }, { unique: true }]],
);
