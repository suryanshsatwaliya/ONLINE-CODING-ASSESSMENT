import { useEffect, useState, lazy, Suspense } from "react";
import { codeService } from "../../services/codeService";
import { errorMessage } from "../../services/api";
const CodeEditor = lazy(() => import("../coding/CodeEditor"));
import LanguageSelector from "../coding/LanguageSelector";
import ProblemDescription from "../coding/ProblemDescription";
import TestCases from "../coding/TestCases";
import Console from "../coding/Console";
import RunResult from "../coding/RunResult";
import Button from "../common/Button";
import ConfirmDialog from "../common/ConfirmDialog";
export default function CodingQuestion({
  question: q,
  value,
  onChange,
  attemptId,
  flush,
}) {
  const language = value?.language || q.supportedLanguages[0],
    code = value?.code ?? q.starterCode[language] ?? "";
  const [result, R] = useState(null),
    [busy, B] = useState(false),
    [error, E] = useState(""),
    [job, J] = useState(null),
    [reset, Reset] = useState(false);
  useEffect(() => {
    if (!job) return;
    const t = setInterval(async () => {
      try {
        const { data } = await codeService.get(job);
        R(data);
        if (["DONE", "ERROR"].includes(data.status)) {
          J(null);
          B(false);
        }
      } catch (e) {
        E(errorMessage(e));
        J(null);
        B(false);
      }
    }, 1800);
    return () => clearInterval(t);
  }, [job]);
  async function run(submit) {
    B(true);
    E("");
    R(null);
    try {
      onChange({ code, language });
      await flush();
      const { data } = await codeService[submit ? "submit" : "run"]({
        attemptId,
        questionId: q._id,
        code,
        language,
      });
      R(data);
      if (submit) J(data.submissionId);
      else B(false);
    } catch (e) {
      E(errorMessage(e));
      B(false);
    }
  }
  return (
    <div className="coding-layout">
      <ProblemDescription question={q} />
      <div className="coding-workspace">
        <div className="code-toolbar">
          <LanguageSelector
            languages={q.supportedLanguages}
            value={language}
            onChange={(l) =>
              onChange({ language: l, code: q.starterCode[l] || "" })
            }
          />
          <button onClick={() => Reset(true)}>Reset code</button>
        </div>
        <Suspense fallback={<p>Loading code editor…</p>}>
          <CodeEditor
            language={language}
            value={code}
            onChange={(code) => onChange({ language, code })}
          />
        </Suspense>
        <div className="code-toolbar">
          <span>
            {busy
              ? "Running…"
              : "Saved code drafts are graded on final submission."}
          </span>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => run(false)}
          >
            Run Code
          </Button>
          <Button disabled={busy} onClick={() => run(true)}>
            Submit Code
          </Button>
        </div>
        {error && <p className="error">{error}</p>}
        <RunResult result={result} />
        <h3>Test cases / Console</h3>
        <TestCases cases={q.testCases} />
        <Console result={result} />
      </div>
      {reset && (
        <ConfirmDialog
          title="Reset code?"
          onClose={() => Reset(false)}
          onConfirm={() => {
            onChange({ language, code: q.starterCode[language] || "" });
            Reset(false);
          }}
        >
          Replace the current draft with starter code?
        </ConfirmDialog>
      )}
    </div>
  );
}
