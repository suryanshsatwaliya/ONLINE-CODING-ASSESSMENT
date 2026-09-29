import { model, Schema, ref } from "./shared.js";
export default model(
  "ProctorEvent",
  {
    attemptId: ref("Attempt"),
    studentId: ref("Student"),
    assessmentId: ref("Assessment"),
    eventId: String,
    eventType: String,
    timestamp: Date,
    warningIssued: Boolean,
    warningCountAfterEvent: Number,
    metadata: Schema.Types.Mixed,
  },
  [[{ attemptId: 1, eventId: 1 }, { unique: true }]],
);
