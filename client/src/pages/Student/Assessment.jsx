import ExamWorkspace from "../../components/assessment/ExamWorkspace";
import { examSections } from "../../utils/examSections";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { attemptService } from "../../services/attemptService";
import { errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import { useTimer } from "../../hooks/useTimer";
import { useFullscreen } from "../../hooks/useFullscreen";
import { useProctoring } from "../../hooks/useProctoring";
import { useAutosave } from "../../hooks/useAutosave";
import { AssessmentContext } from "../../context/AssessmentContext";
import WarningModal from "../../components/assessment/WarningModal";
import SubmitDialog from "../../components/assessment/SubmitDialog";
import Loader from "../../components/common/Loader";
export default function Assessment() {
  const { id } = useParams(),
    nav = useNavigate(),
    { user } = useAuth(),
    fs = useFullscreen();
  const [data, D] = useState(null),
    [answers, A] = useState({}),
    [current, C] = useState(0),
    [warning, W] = useState(null),
    [confirm, Confirm] = useState(false),
    [error, E] = useState("");
  const active = data?.attempt.status === "ACTIVE";
  const seconds = useTimer(data?.attempt.expiresAt, data?.serverTime);
  const { save, flush, status } = useAutosave(id, active);
  const refresh = useCallback(
    async (initial = false) => {
      try {
        const { data: d } = await attemptService.get(id);
        D(d);
        if (initial) {
          A(d.attempt.answers || {});
          C(examSections(d.assessment.questions)[0]?.indexes[0] ?? 0);
        }
        if (d.attempt.status !== "ACTIVE")
          nav("/student/result/" + id, { replace: true });
      } catch (e) {
        E(errorMessage(e));
      }
    },
    [id, nav],
  );
  const connected = useSocket(
    useCallback(
      (name) => {
        if (["ATTEMPT_UPDATE", "ASSESSMENT_ENDED"].includes(name)) refresh();
      },
      [refresh],
    ),
  );
  useEffect(() => {
    refresh(true);
    const t = setInterval(() => refresh(), 10000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (data && seconds === 0) refresh();
  }, [seconds]);
  const securityKey = JSON.stringify(data?.assessment.securitySettings);
  const stableSettings = useMemo(
    () => (securityKey ? JSON.parse(securityKey) : null),
    [securityKey],
  );
  useProctoring({
    attemptId: id,
    active,
    settings: stableSettings,
    onWarning: (w) => {
      W(w);
      D((d) => ({
        ...d,
        attempt: { ...d.attempt, warningCount: w.warningCount },
      }));
    },
    onClosed: refresh,
  });
  function change(value, marked) {
    const q = data.assessment.questions[current];
    const answer = { value, marked: marked ?? answers[q._id]?.marked ?? false };
    A((old) => ({ ...old, [q._id]: answer }));
    save({ questionId: q._id, ...answer });
  }
  async function submit() {
    try {
      await flush();
      await attemptService.submit(id);
      nav("/student/result/" + id, { replace: true });
    } catch (e) {
      E(errorMessage(e));
      refresh();
    }
  }
  if (!data) return error ? <p className="error">{error}</p> : <Loader />;
  const { assessment: a, attempt: t } = data;
  return (
    <AssessmentContext.Provider value={{ assessment: a, attempt: t }}>
      <ExamWorkspace assessment={a} attempt={t} name={user.name} seconds={seconds}
        connected={connected} answers={answers} current={current} onNavigate={C}
        change={change} status={status} attemptId={id} flush={flush}
        onSubmit={() => Confirm(true)} fullscreen={fs.fullscreen}
        onFullscreen={() => fs.enter().catch((e) => E(e.message))} error={error}>
        {warning && (
          <WarningModal
            warning={warning}
            max={a.securitySettings.maxWarnings}
            onReturn={async () => {
              try {
                if (a.securitySettings.requireFullscreen && !fs.fullscreen)
                  await fs.enter();
                W(null);
              } catch (e) {
                E(e.message);
              }
            }}
          />
        )}{" "}
        {confirm && (
          <SubmitDialog onClose={() => Confirm(false)} onConfirm={submit} />
        )}
      </ExamWorkspace>
    </AssessmentContext.Provider>
  );
}
