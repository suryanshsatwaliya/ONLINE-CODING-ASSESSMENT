import mongoose from "mongoose";
import { Assessment, AssessmentStudent } from "../models/index.js";
import { emitAssessment } from "./realtime.service.js";

// Claim the same assessment document as manual starts, edits and assignments.
// Using the scheduled timestamp keeps downtime from extending the test window.
export async function startScheduledAssessments(id) {
  const due = await Assessment.find({
    ...(id ? { _id: id } : {}),
    status: "SCHEDULED", startTime: { $ne: null, $lte: new Date() },
  }).select("_id");
  for (const candidate of due) {
    const changed = await mongoose.connection.transaction(async (session) => {
      const a = await Assessment.findOne({ _id: candidate._id, status: "SCHEDULED", startTime: { $ne: null, $lte: new Date() } })
        .select("+accessCodeHash +accessCodeKey").session(session);
      if (!a) return null;
      const closesAt = new Date(Math.min(+a.startTime + a.duration * 60000, a.endTime ? +a.endTime : Infinity));
      if (+closesAt <= Date.now()) {
        a.status = "ENDED";
        a.endedAt = closesAt;
        a.endReason = "TIME_EXPIRED";
      } else {
        if (!a.questions.length || !a.accessCodeHash || !a.accessCodeKey ||
            !await AssessmentStudent.exists({ assessment: a._id }).session(session)) return null;
        a.status = "LIVE";
      }
      a.startedAt = a.startTime;
      a.closesAt = closesAt;
      a.admissionClosesAt = closesAt;
      a.revision++;
      await a.save({ session });
      return a;
    });
    if (changed) emitAssessment(changed, changed.status === "LIVE" ? "ASSESSMENT_STARTED" : "ASSESSMENT_ENDED", { assessmentId: changed._id });
  }
}
