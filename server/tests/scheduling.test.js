import test from "node:test";
import assert from "node:assert/strict";
import { updateAssessmentTiming } from "../../client/src/utils/assessmentTiming.js";

test("teacher form calculates hard close across midnight and recalculates duration", () => {
  let form = updateAssessmentTiming({ duration: 60 }, "startTime", "2026-10-04T23:30:00+05:30");
  assert.equal(form.endTime, "2026-10-04T19:00:00.000Z");
  form = updateAssessmentTiming(form, "duration", 15);
  assert.equal(form.endTime, "2026-10-04T18:15:00.000Z");
  assert.equal(updateAssessmentTiming(form, "startTime", null).endTime, null);
  assert.equal(updateAssessmentTiming(form, "duration", "").endTime, null);
});
