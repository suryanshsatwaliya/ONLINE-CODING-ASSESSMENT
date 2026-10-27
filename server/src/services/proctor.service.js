import { ProctorEvent } from "../models/index.js";
import { withActive } from "./assessment.service.js";
import { closeAttempt } from "./attemptLifecycle.service.js";
import { gradeAttempt } from "./grading.service.js";
import { emitAttempt } from "./realtime.service.js";
const toggles = {
  FULLSCREEN_EXIT: "requireFullscreen",
  TAB_HIDDEN: "monitorTabSwitching",
  WINDOW_BLUR: "monitorWindowFocus",
  WINDOW_FOCUS: "monitorWindowFocus",
  COPY_ATTEMPT: "blockCopy",
  PASTE_ATTEMPT: "blockPaste",
  CUT_ATTEMPT: "blockCut",
  CONTEXT_MENU_ATTEMPT: "blockContextMenu",
  PAGE_EXIT_ATTEMPT: "monitorPageExit",
};
export function warningDecision(settings, type, t, now) {
  const group = [
    "WINDOW_BLUR",
    "TAB_HIDDEN",
    "FULLSCREEN_EXIT",
    "PAGE_EXIT_ATTEMPT",
  ].includes(type)
    ? "LEAVE"
    : type;
  const enabled = !toggles[type] || settings[toggles[type]];
  const defaultRule = [
    "FULLSCREEN_EXIT",
    "TAB_HIDDEN",
    "WINDOW_BLUR",
    "COPY_ATTEMPT",
    "PASTE_ATTEMPT",
    "CUT_ATTEMPT",
    "CONTEXT_MENU_ATTEMPT",
    "PAGE_EXIT_ATTEMPT",
  ].includes(type)
    ? "WARNING"
    : "LOG";
  const rule = enabled ? settings.eventRules?.[type] || defaultRule : "IGNORE";
  const duplicate =
    t.lastWarningGroup === group && now - new Date(t.lastWarningAt || 0) < 2000;
  return { group, rule, warn: rule === "WARNING" && !duplicate };
}
export async function recordEvent(user, body) {
  const out = await withActive(body.attemptId, user, async (t, a, session) => {
    const existing = await ProctorEvent.findOne({
      attemptId: t._id,
      eventId: body.eventId,
    }).session(session);
    if (existing) return existing;
    const now = new Date(),
      d = warningDecision(a.securitySettings, body.eventType, t, now);
    if (d.warn) {
      t.warningCount++;
      t.lastWarningAt = now;
      t.lastWarningGroup = d.group;
    }
    const [event] = await ProctorEvent.create(
      [
        {
          attemptId: t._id,
          studentId: t.student,
          assessmentId: a._id,
          eventId: body.eventId,
          eventType: body.eventType,
          timestamp: now,
          warningIssued: d.warn,
          warningCountAfterEvent: t.warningCount,
          metadata: { rule: d.rule },
        },
      ],
      { session },
    );
    // Proctoring events issue warnings; reaching the warning limit submits
    // and grades the attempt. Never terminate directly for copy/paste,
    // right-click, or legacy TERMINATE warning-limit settings.
    if (d.warn && t.warningCount >= a.securitySettings.maxWarnings)
      await closeAttempt(t, a, "SUBMITTED", session);
    return event;
  });
  emitAttempt(out.a, out.t);
  if (out.t.status !== "ACTIVE") await gradeAttempt(out.t._id);
  return {
    warningCount: out.t.warningCount,
    status: out.t.status,
    warningIssued: out.result.warningIssued,
    eventType: body.eventType,
  };
}
