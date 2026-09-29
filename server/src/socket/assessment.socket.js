import { Attempt } from "../models/index.js";
import { recordEvent } from "../services/proctor.service.js";
import { randomUUID } from "node:crypto";
export async function connectionEvent(user, eventType) {
  const t = await Attempt.findOne({
    student: user.id,
    assessment: user.assessmentId,
    status: "ACTIVE",
  });
  if (!t) return;
  await Attempt.updateOne(
    { _id: t._id },
    { $set: { connected: eventType === "RECONNECTED" } },
  );
  try {
    await recordEvent(user, {
      attemptId: String(t._id),
      eventType,
      eventId: randomUUID(),
    });
  } catch {
    /* Closed attempts remain immutable. */
  }
}
