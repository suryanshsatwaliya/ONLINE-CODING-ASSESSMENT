import { model, Schema, ref } from "./shared.js";
export default model(
  "Answer",
  {
    attempt: ref("Attempt"),
    questionId: String,
    value: Schema.Types.Mixed,
    marked: Boolean,
  },
  [[{ attempt: 1, questionId: 1 }, { unique: true }]],
);
