import { model, Schema, ref } from "./shared.js";
export default model(
  "ExecutionResult",
  {
    submission: ref("CodeSubmission"),
    results: [Schema.Types.Mixed],
    score: Number,
  },
  [[{ submission: 1 }, { unique: true }]],
);
