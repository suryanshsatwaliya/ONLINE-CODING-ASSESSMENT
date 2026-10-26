import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { ChevronDown, ChevronUp, GripHorizontal, ListChecks, Terminal } from "lucide-react";
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
  preview = false,
  theme = "dark",
}) {
  const languages = Array.isArray(q.supportedLanguages) && q.supportedLanguages.length
      ? q.supportedLanguages
      : ["python"],
    starterCode = q.starterCode && typeof q.starterCode === "object" ? q.starterCode : {},
    language = languages.includes(value?.language) ? value.language : languages[0],
    code = value?.code ?? starterCode[language] ?? "";
  const [result, R] = useState(null),
    [busy, B] = useState(false),
    [error, E] = useState(""),
    [job, J] = useState(null),
    [reset, Reset] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleHeight, setConsoleHeight] = useState(() => Math.min(300, Math.max(180, window.innerHeight * 0.34)));
  const resizeStart = useRef(null);
  const outputContentRef = useRef(null);
  const [outputTab, setOutputTab] = useState("testcase");
  useEffect(() => {
    if (!consoleOpen || outputTab !== "testcase") return;
    const frame = requestAnimationFrame(() => {
      const content = outputContentRef.current;
      if (!content) return;
      const headerHeight = content.parentElement?.querySelector(".coding-console-header")?.offsetHeight || 40;
      setConsoleHeight(content.scrollHeight + headerHeight + 2);
    });
    return () => cancelAnimationFrame(frame);
  }, [consoleOpen, outputTab, q._id]);
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
    setConsoleOpen(true);
    setOutputTab("result");
    if (preview) {
      E("This is an interface preview. Code execution is available during a real assessment.");
      return;
    }
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
        <div className="coding-editor-pane">
          <div className="code-toolbar coding-editor-toolbar">
            <div className="coding-editor-settings">
              <LanguageSelector
                languages={languages}
                value={language}
                onChange={(l) => onChange({ language: l, code: starterCode[l] || "" })}
              />
              <button type="button" onClick={() => Reset(true)}>Reset code</button>
            </div>
            <div className="coding-run-actions">
              <Button variant="secondary" disabled={busy} onClick={() => run(false)}>{busy ? "Running…" : "Run Code"}</Button>
              <Button disabled={busy} onClick={() => run(true)}>Submit Code</Button>
            </div>
          </div>
          <div className="coding-editor-surface">
            <Suspense fallback={<p>Loading code editor…</p>}>
              <CodeEditor
                theme={theme}
                language={language}
                value={code}
                onChange={(code) => onChange({ language, code })}
                height="100%"
              />
            </Suspense>
          </div>
        </div>
        {consoleOpen && <div
          className="coding-console-resize"
          role="separator"
          aria-label="Resize test results panel"
          aria-orientation="horizontal"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            resizeStart.current = { y: event.clientY, height: consoleHeight };
          }}
          onPointerMove={(event) => {
            if (!resizeStart.current) return;
            const workspaceHeight = event.currentTarget.parentElement?.clientHeight || window.innerHeight;
            const maxHeight = Math.max(160, workspaceHeight - 210);
            setConsoleHeight(Math.max(120, Math.min(maxHeight, resizeStart.current.height + resizeStart.current.y - event.clientY)));
          }}
          onPointerUp={() => { resizeStart.current = null; }}
          onPointerCancel={() => { resizeStart.current = null; }}
        ><GripHorizontal size={18} /></div>}
        <section className={`coding-console-panel${consoleOpen ? " is-open" : " is-collapsed"}`} aria-label="Test cases and results" style={consoleOpen ? { height: `${consoleHeight}px` } : undefined}>
          <div className="coding-console-header">
            <div className="coding-output-tabs" role="tablist" aria-label="Code output">
              <button type="button" role="tab" aria-selected={outputTab === "testcase"} onClick={() => setOutputTab("testcase")}><ListChecks size={15} />Testcase</button>
              <button type="button" role="tab" aria-selected={outputTab === "result"} onClick={() => { setOutputTab("result"); setConsoleOpen(true); }}><Terminal size={15} />Test Result</button>
            </div>
            {busy && <span className="coding-console-running">Running code…</span>}
            <button type="button" className="coding-console-toggle" onClick={() => setConsoleOpen((open) => !open)} aria-label={consoleOpen ? "Collapse test panel" : "Expand test panel"} aria-expanded={consoleOpen}>
              {consoleOpen ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
            </button>
          </div>
          {consoleOpen && <div className="coding-console-content" ref={outputContentRef}>
            {outputTab === "testcase" ? <TestCases cases={q.testCases} /> : <>
              {error && <p className="error">{error}</p>}
              {busy && !result && !error && <p className="coding-console-empty">Running your code…</p>}
              <RunResult result={result} />
              <Console result={result} />
            </>}
          </div>}
        </section>
      </div>
      {reset && (
        <ConfirmDialog
          title="Reset code?"
          onClose={() => Reset(false)}
          onConfirm={() => {
            onChange({ language, code: starterCode[language] || "" });
            Reset(false);
          }}
        >
          Replace the current draft with starter code?
        </ConfirmDialog>
      )}
    </div>
  );
}
