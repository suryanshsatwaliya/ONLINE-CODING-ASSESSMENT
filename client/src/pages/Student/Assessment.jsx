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
import AssessmentHeader from "../../components/assessment/AssessmentHeader";
import QuestionNavigator from "../../components/assessment/QuestionNavigator";
import MCQQuestion from "../../components/assessment/MCQQuestion";
import ShortAnswer from "../../components/assessment/ShortAnswer";
import CodingQuestion from "../../components/assessment/CodingQuestion";
import WarningModal from "../../components/assessment/WarningModal";
import SubmitDialog from "../../components/assessment/SubmitDialog";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
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
        if (initial) A(d.attempt.answers || {});
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
  const { assessment: a, attempt: t } = data,
    q = a.questions[current],
    answer = answers[q?._id];
  return (
    <AssessmentContext.Provider value={{ assessment: a, attempt: t }}>
      <div className="exam">
        <AssessmentHeader
          title={a.title}
          name={user.name}
          seconds={seconds}
          warnings={t.warningCount}
          max={a.securitySettings.maxWarnings}
          connected={connected}
          onSubmit={() => Confirm(true)}
        />
        {a.securitySettings.requireFullscreen && !fs.fullscreen && (
          <div className="fullscreen-bar">
            Fullscreen is required.{" "}
            <Button onClick={() => fs.enter().catch((e) => E(e.message))}>
              Return to fullscreen
            </Button>
          </div>
        )}
        <div className="exam-body">
          <aside className="exam-sidebar">
            <span className="eyebrow">YOUR PROGRESS</span>
            <h3>Questions</h3>
            <QuestionNavigator
              questions={a.questions}
              answers={answers}
              current={current}
              onChange={C}
            />
            <p className="muted">
              Blue: answered
              <br />
              Purple dot: marked for review
            </p>
            <div className="save-status">{status}</div>
          </aside>
          <main className="exam-main">
            {q && (
              <>
                <div className="row between">
                  <span className="eyebrow">
                    QUESTION {current + 1} OF {a.questions.length}
                  </span>
                  <span>
                    {q.marks} marks{" "}
                    {q.negativeMarks > 0 &&
                      " / −" + q.negativeMarks + " incorrect"}
                  </span>
                </div>
                {q.type === "CODING" ? (
                  <CodingQuestion
                    key={q._id}
                    question={q}
                    value={answer?.value}
                    onChange={change}
                    attemptId={id}
                    flush={flush}
                  />
                ) : (
                  <div className="question-content">
                    <h2>{q.question || q.title}</h2>
                    {q.type === "SHORT" ? (
                      <ShortAnswer
                        value={answer?.value || ""}
                        onChange={change}
                      />
                    ) : (
                      <MCQQuestion
                        question={q}
                        value={answer?.value || []}
                        order={t.optionOrders?.[q._id]}
                        onChange={change}
                      />
                    )}
                  </div>
                )}
                <div className="row between wrap question-actions">
                  <Button
                    variant="secondary"
                    disabled={current === 0}
                    onClick={() => C(current - 1)}
                  >
                    ← Previous
                  </Button>
                  <button
                    onClick={() =>
                      change(
                        answer?.value ??
                          (q.type === "SHORT"
                            ? ""
                            : q.type === "CODING"
                              ? {
                                  language: q.supportedLanguages[0],
                                  code:
                                    q.starterCode[q.supportedLanguages[0]] ||
                                    "",
                                }
                              : []),
                        !answer?.marked,
                      )
                    }
                  >
                    {answer?.marked ? "Unmark review" : "Mark for review"}
                  </button>
                  <Button
                    disabled={current === a.questions.length - 1}
                    onClick={() => C(current + 1)}
                  >
                    Next question →
                  </Button>
                </div>
              </>
            )}
            {error && <p className="error">{error}</p>}
          </main>
        </div>
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
      </div>
    </AssessmentContext.Provider>
  );
}
