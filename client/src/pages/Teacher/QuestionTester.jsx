import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, GripHorizontal, GripVertical, ListChecks, RotateCcw, Terminal } from "lucide-react";
import { api, errorMessage } from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
import LanguageSelector from "../../components/coding/LanguageSelector";
import ProblemDescription from "../../components/coding/ProblemDescription";
import TestCases from "../../components/coding/TestCases";
import Console from "../../components/coding/Console";
import RunResult from "../../components/coding/RunResult";
import Button from "../../components/common/Button";
import "../../exam-modern.css";

const CodeEditor = lazy(() => import("../../components/coding/CodeEditor"));

export default function QuestionTester({ questionSet = false }) {
  const { id, index: indexParam } = useParams();
  const { theme } = useTheme();
  const index = Number(indexParam);
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [language, setLanguage] = useState("");
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [execution, setExecution] = useState(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [outputTab, setOutputTab] = useState("testcase");
  const [consoleHeight, setConsoleHeight] = useState(() => Math.max(190, Math.round(window.innerHeight * 0.34)));
  const [questionPanePercent, setQuestionPanePercent] = useState(() => {
    const saved = Number(window.localStorage.getItem("teacher-question-tester-pane-percent"));
    return Number.isFinite(saved) && saved >= 25 && saved <= 70 ? saved : 42;
  });
  const layoutRef = useRef(null);
  const paneResizeRef = useRef(null);
  const consoleResizeRef = useRef(null);
  const completeProgram = question?.executionConfig?.mode === "STDIO";
  const languages = question?.supportedLanguages || [];
  const visibleTests = useMemo(() => {
    if (!question) return [];
    const publicTests = (question.testCases || []).filter((test) => !test.hidden);
    return completeProgram ? publicTests.slice(0, 1) : publicTests;
  }, [question, completeProgram]);
  const sampleStatus = execution?.results?.[0]?.status;
  const sampleOutputState = sampleStatus
    ? sampleStatus === "Accepted" ? "is-match" : "is-mismatch"
    : execution?.error || runError ? "is-mismatch" : "";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setQuestion(null);
    setExecution(null);
    setRunError("");
    const loadQuestion = questionSet
      ? api.get(`/question-sets/${id}`).then(({ data }) => data.questions?.[index])
      : api.get(`/questions/${id}`).then(({ data }) => data);
    loadQuestion.then((data) => {
      if (!active) return;
      if (!data || data.type !== "CODING") throw new Error("This coding question could not be found.");
      setQuestion(data);
      const initialLanguage = data.supportedLanguages?.includes("cpp") ? "cpp" : data.supportedLanguages?.[0] || "";
      setLanguage(initialLanguage);
      setCode(data.starterCode?.[initialLanguage] || "");
      setLoadError("");
    }).catch((error) => {
      if (active) setLoadError(errorMessage(error));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, index, questionSet]);

  function persistQuestionPanePercent(percent) {
    const next = Math.max(25, Math.min(70, percent));
    setQuestionPanePercent(next);
    window.localStorage.setItem("teacher-question-tester-pane-percent", String(next));
  }

  function resizePanes(event) {
    const start = paneResizeRef.current;
    if (!start || !layoutRef.current) return;
    const stacked = window.matchMedia("(max-width: 760px)").matches;
    const ratio = stacked
      ? ((event.clientY - start.top) / start.height) * 100
      : ((event.clientX - start.left) / start.width) * 100;
    persistQuestionPanePercent(ratio);
  }

  function stopPaneResize() {
    paneResizeRef.current = null;
    document.body.classList.remove("question-tester-is-resizing");
  }

  function changeLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    setCode(question?.starterCode?.[nextLanguage] || "");
    setExecution(null);
    setRunError("");
  }

  function resetTerminal() {
    if (running) return;
    setExecution(null);
    setRunError("");
    setOutputTab("testcase");
    setConsoleOpen(true);
  }

  async function runTests(submit = false) {
    setConsoleOpen(true);
    setOutputTab("result");
    setRunning(true);
    setRunError("");
    setExecution(null);
    try {
      const endpoint = questionSet
        ? `/question-sets/${id}/questions/${index}/test-run`
        : `/questions/${id}/test-run`;
      const { data } = await api.post(endpoint, { code, language, submit });
      setExecution(data);
    } catch (error) {
      setRunError(errorMessage(error));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="question-tester-page exam-modern" data-theme={theme}>
      {loading && <div className="card question-tester-notice" role="status">Loading the saved question…</div>}
      {loadError && <div className="notice error question-tester-notice" role="alert">{loadError}</div>}

      {question && <>
        <div className="question-tester-nav">
          <Link
            className="question-tester-back"
            to={questionSet ? `/teacher/questions/sets/${id}` : "/teacher/questions"}
          >
            <ArrowLeft size={17} />
            {questionSet ? "Back to question set" : "Back to Question Bank"}
          </Link>
          <span>TEACHER WORKSPACE · QUESTION TESTER</span>
        </div>
        <section className="question-tester-layout">
        <header className="question-tester-workbench-heading">
          <span>QUESTION 1 OF 1</span>
          <span className="question-tester-marks">{question.marks} marks</span>
        </header>

        <div
          className="question-tester-workbench-split"
          ref={layoutRef}
          style={{ "--question-tester-pane-percent": `${questionPanePercent}%` }}
          onPointerMove={resizePanes}
          onPointerUp={stopPaneResize}
          onPointerCancel={stopPaneResize}
        >
          <section className="question-tester-problem-pane" aria-label="Question">
            <ProblemDescription question={question} />
          </section>

          <div
            className="question-tester-divider coding-pane-resize"
            role="separator"
            aria-label="Resize question and coding panels"
            aria-orientation={window.innerWidth <= 760 ? "horizontal" : "vertical"}
            aria-valuemin={25}
            aria-valuemax={70}
            aria-valuenow={Math.round(questionPanePercent)}
            tabIndex={0}
            onPointerDown={(event) => {
              const bounds = layoutRef.current.getBoundingClientRect();
              paneResizeRef.current = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
              event.currentTarget.setPointerCapture(event.pointerId);
              document.body.classList.add("question-tester-is-resizing");
            }}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
              event.preventDefault();
              persistQuestionPanePercent(questionPanePercent + (["ArrowRight", "ArrowDown"].includes(event.key) ? 2 : -2));
            }}
          >{window.innerWidth <= 760 ? <GripHorizontal size={16} /> : <GripVertical size={16} />}</div>

          <section className="question-tester-code-workspace" aria-label="Code editor and test results">
          <div className="question-tester-editor-pane coding-editor-pane">
            <div className="code-toolbar coding-editor-toolbar">
              <div className="coding-editor-settings">
                <LanguageSelector languages={languages} value={language} onChange={changeLanguage} />
                <button type="button" className="question-tester-reset-code" onClick={() => { setCode(question.starterCode?.[language] || ""); setExecution(null); setRunError(""); }}>
                  <RotateCcw size={15} />Reset code
                </button>
              </div>
              <div className="coding-run-actions">
                {completeProgram ? (
                  <Button type="button" disabled={running} onClick={() => runTests(false)}>
                    {running ? "Running…" : "Run & grade sample"}
                  </Button>
                ) : <>
                  <Button type="button" variant="secondary" disabled={running} onClick={() => runTests(false)}>
                    {running ? "Running…" : "Run Code"}
                  </Button>
                  <Button type="button" disabled={running} onClick={() => runTests(true)}>
                    Submit Code
                  </Button>
                </>}
              </div>
            </div>
            <div className="coding-editor-surface question-tester-editor">
              <Suspense fallback={<div className="question-tester-editor-loading">Loading code editor…</div>}>
                <CodeEditor
                  theme={theme}
                  language={language}
                  value={code}
                  onChange={(next) => { setCode(next); setExecution(null); }}
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
              consoleResizeRef.current = { y: event.clientY, height: consoleHeight };
            }}
            onPointerMove={(event) => {
              if (!consoleResizeRef.current) return;
              const workspaceHeight = event.currentTarget.parentElement?.clientHeight || window.innerHeight;
              const maxHeight = Math.max(160, workspaceHeight - 190);
              setConsoleHeight(Math.max(140, Math.min(maxHeight, consoleResizeRef.current.height + consoleResizeRef.current.y - event.clientY)));
            }}
            onPointerUp={() => { consoleResizeRef.current = null; }}
            onPointerCancel={() => { consoleResizeRef.current = null; }}
          ><GripHorizontal size={18} /></div>}

          <section
            className={`coding-console-panel${consoleOpen ? " is-open" : " is-collapsed"}`}
            aria-label="Test cases and results"
            style={consoleOpen ? { height: `${consoleHeight}px` } : undefined}
          >
            <div className="coding-console-header">
              <div className="coding-output-tabs" role="tablist" aria-label="Code output">
                <button type="button" role="tab" aria-selected={outputTab === "testcase"} onClick={() => setOutputTab("testcase")}><ListChecks size={15} />Testcase</button>
                <button type="button" role="tab" aria-selected={outputTab === "result"} onClick={() => { setOutputTab("result"); setConsoleOpen(true); }}><Terminal size={15} />Test Result</button>
              </div>
              {running && <span className="coding-console-running">Running code…</span>}
              <div className="coding-console-header-actions">
                <button type="button" className="coding-console-reset" onClick={resetTerminal} disabled={running} aria-label="Reset terminal output" title="Reset terminal output"><RotateCcw size={15} /></button>
                <button type="button" className="coding-console-toggle" onClick={() => setConsoleOpen((open) => !open)} aria-label={consoleOpen ? "Collapse test panel" : "Expand test panel"} aria-expanded={consoleOpen}>
                  {consoleOpen ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                </button>
              </div>
            </div>
            {consoleOpen && <div className="coding-console-content question-tester-console-content">
              {outputTab === "testcase" ? (
                <TestCases cases={visibleTests} results={completeProgram || execution?.hidden ? null : execution?.results} />
              ) : <>
                {runError && <p className="error" role="alert">{runError}</p>}
                {running && !execution && !runError && <p className="coding-console-empty">Running your code…</p>}
                {completeProgram && !execution?.hidden ? <>
                  <RunResult result={execution} />
                  <Console result={execution} />
                  <div className="coding-program-output" aria-label="Program output">
                  <section className="coding-program-expected">
                    <strong>Expected output</strong>
                    <pre>{visibleTests[0]?.expectedOutput || "—"}</pre>
                  </section>
                  <section className={`coding-program-actual ${sampleOutputState}`}>
                    <strong>Your output</strong>
                    <pre>{execution?.results?.[0]?.stdout || (running ? "Running…" : execution ? "No output produced." : "Run your code to see its output.")}</pre>
                  </section>
                  {(execution?.error || execution?.results?.[0]?.compileOutput || execution?.results?.[0]?.stderr) && <p className="coding-program-error">{execution.error || execution.results?.[0]?.compileOutput || execution.results?.[0]?.stderr}</p>}
                  </div>
                </> : <>
                  <RunResult result={execution} />
                  <Console result={execution} cases={visibleTests} />
                  {!execution && !running && !runError && <p className="coding-console-empty">Run your code to see output for each configured test case.</p>}
                </>}
              </>}
            </div>}
          </section>
          </section>
        </div>
        </section>
      </>}
    </main>
  );
}
