import { model, Schema, ref } from "./shared.js";
export default model(
  "AssessmentStudent",
  { assessment: ref("Assessment"), student: ref("Student"), reentryAllowed: { type: Boolean, default: false } },
  [[{ assessment: 1, student: 1 }, { unique: true }]],
);
