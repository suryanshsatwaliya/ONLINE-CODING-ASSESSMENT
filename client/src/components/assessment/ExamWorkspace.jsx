import { useTheme } from "../../context/ThemeContext";
import { Flag, ShieldCheck, RotateCcw, ListChecks, Code2 } from "lucide-react";
import { examSections } from "../../utils/examSections";
import { ModernExamHeader, ModernExamProgress, hasAnswer } from "./ModernExamChrome";
import MCQQuestion from "./MCQQuestion";
import ShortAnswer from "./ShortAnswer";
import CodingQuestion from "./CodingQuestion";
import Button from "../common/Button";
import "../../exam-modern.css";

export default function ExamWorkspace({ assessment: a, attempt: t, name, seconds, connected, answers, current, onNavigate, change, status, attemptId, flush, onSubmit, fullscreen = true, onFullscreen, error, children, preview = false }) {
  const { theme } = useTheme();
  const q = a.questions[current], answer = answers[q?._id];
  const answered = a.questions.filter((q) => hasAnswer(answers[q._id]?.value)).length;
  const marked = a.questions.filter((q) => answers[q._id]?.marked).length;
  const sections = examSections(a.questions);
  const section = sections.find((item) => item.indexes.includes(current));
  const mixed = sections.length > 1;
  const orderedIndexes = sections.flatMap((item) => item.indexes);
  const position = orderedIndexes.indexOf(current);
  const nextIndex = orderedIndexes[position + 1];
  const nextSection = sections.find((item) => item.indexes.includes(nextIndex));
  return <div className="exam exam-modern" data-theme={theme}>
        <ModernExamHeader {...{ a, t, name, seconds, connected, onSubmit }} />
        {a.securitySettings.requireFullscreen && !fullscreen && (
          <div className="fullscreen-bar">
            Fullscreen is required.{" "}
            <Button onClick={onFullscreen}>
              Return to fullscreen
            </Button>
          </div>
        )}
        <div className="exam-body">
          <aside className="exam-sidebar">
            <ModernExamProgress {...{ a, answers, current, onNavigate, status, answered, marked, sections }} />
          </aside>
          <main className="exam-main">
            {mixed && <nav className="em-section-tabs" aria-label="Assessment sections">
              {sections.map((item) => {
                const Icon = item.id === "coding" ? Code2 : ListChecks;
                return <button type="button" key={item.id} aria-pressed={section?.id === item.id}
                  onClick={() => section?.id !== item.id && onNavigate(item.indexes.find((i) => !hasAnswer(answers[a.questions[i]._id]?.value)) ?? item.indexes[0])}>
                  <Icon size={18} /><span>{item.label}</span><small>{item.indexes.length} {item.indexes.length === 1 ? "question" : "questions"}</small>
                </button>;
              })}
            </nav>}
            {q && (
              <>
                <div className="row between">
                  <span className="eyebrow">
                    {mixed ? `${section.label.toUpperCase()} · QUESTION ${section.indexes.indexOf(current) + 1} OF ${section.indexes.length}` : `QUESTION ${current + 1} OF ${a.questions.length}`}
                  </span>
                  <span className="exam-marks">
                    {q.marks} marks{" "}
                    {q.negativeMarks > 0 &&
                      " / −" + q.negativeMarks + " incorrect"}
                  </span>
                </div>
                {q.type === "CODING" ? (
                  <CodingQuestion
                    theme={theme}
                    preview={preview}
                    key={q._id}
                    question={q}
                    value={answer?.value}
                    onChange={change}
                    attemptId={attemptId}
                    flush={flush}
                  />
                ) : (
                  <div className="question-content">
                    <div className="exam-question-kind"><span>{q.type === "SHORT" ? "Written response" : q.type === "MULTIPLE" ? "Multiple answers" : "Single answer"}</span><span>{answer?.marked ? "Flagged for review" : ""}</span></div>
                    <h2>{q.question || q.title}</h2>
                    <p className="exam-question-hint">{q.type === "SHORT" ? "Write your answer in the space below." : q.type === "MULTIPLE" ? "Select all answers that apply." : "Choose one answer below."}</p>
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
                    <div className="em-response-actions">
                      <button type="button" className="em-clear-response" disabled={!hasAnswer(answer?.value)}
                        onClick={() => change(q.type === "SHORT" ? "" : [])}>
                        <RotateCcw size={14} />Clear response
                      </button>
                    </div>
                  </div>
                )}
                <div className="row between wrap question-actions">
                  <Button
                    variant="secondary"
                    disabled={position <= 0}
                    onClick={() => onNavigate(orderedIndexes[position - 1])}
                  >
                    ← Previous
                  </Button>
                  <button className="exam-review-action" aria-pressed={Boolean(answer?.marked)}
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
                    <Flag size={16} /> {answer?.marked ? "Unmark review" : "Mark for review"}
                  </button>
                  <Button
                    onClick={() => nextIndex === undefined ? onSubmit() : onNavigate(nextIndex)}
                  >
                    {nextIndex === undefined ? "Review & submit" : nextSection?.id !== section?.id ? `Go to ${nextSection.label} →` : "Next question →"}
                  </Button>
                </div>
              </>
            )}
            <div className="exam-bottom-note"><ShieldCheck size={14} /> Your answers are saved as you go. Review them before submitting.</div>
            {error && <p className="error">{error}</p>}
          </main>
        </div>
      {children}
    </div>;
}
