import {
  CodeSubmission,
  Assessment,
  ExecutionResult,
  Attempt,
  Result,
} from "../models/index.js";
import { execute } from "./codeRunner.service.js";
import { gradeAttempt } from "./grading.service.js";
import { expireAttempts } from "./attemptLifecycle.service.js";
import { emitAttempt } from "./realtime.service.js";
let busy = false;
export async function tick() {
  if (busy) return;
  busy = true;
  try {
    const now = new Date();
    const sub = await CodeSubmission.findOneAndUpdate(
      {
        $or: [
          { status: "QUEUED" },
          { status: "RUNNING", leaseUntil: { $lt: now } },
        ],
      },
      {
        $set: {
          status: "RUNNING",
          leaseUntil: new Date(Date.now() + 20 * 60000),
        },
        $inc: { retries: 1 },
      },
      { new: true, sort: { createdAt: 1 } },
    );
    if (sub) {
      const a = await Assessment.findById(sub.assessment),
        q = a.questions.find((q) => String(q._id) === sub.questionId);
      try {
        const execution = await execute(q, sub.code, sub.language, true);
        await ExecutionResult.findOneAndUpdate(
          { submission: sub._id },
          { $set: execution },
          { upsert: true },
        );
        sub.status = "DONE";
        sub.score = execution.score;
        sub.error = undefined;
      } catch (e) {
        sub.status = sub.retries < 3 ? "QUEUED" : "ERROR";
        sub.error =
          e.status === 503
            ? e.message
            : "Execution service unavailable; teacher may retry";
      }
      await sub.save();
      await gradeAttempt(sub.attempt);
      const t = await Attempt.findById(sub.attempt);
      emitAttempt(a, t);
    }
    const closed = await Attempt.find({ status: { $ne: "ACTIVE" } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .select("_id")
      .lean();
    const ids = closed.map((t) => t._id);
    for (const id of ids) {
      if (!(await Result.exists({ attempt: id }))) await gradeAttempt(id);
    }
  } finally {
    busy = false;
  }
}
export function startWorker() {
  let maintaining = false;
  const maintain = async () => {
    if (maintaining) return;
    maintaining = true;
    try {
      await expireAttempts();
    } catch (e) {
      console.error("Expiry worker:", e.message);
    } finally {
      maintaining = false;
    }
  };
  const timer = setInterval(
    () => tick().catch((e) => console.error("Grading worker:", e.message)),
    3000,
  );
  const expiryTimer = setInterval(maintain, 3000);
  maintain();
  tick().catch(console.error);
  return () => {
    clearInterval(timer);
    clearInterval(expiryTimer);
  };
}
