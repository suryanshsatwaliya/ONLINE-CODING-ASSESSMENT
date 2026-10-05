import { ShieldCheck, Clock3, Flag, Check, CheckCircle2, Wifi, WifiOff } from "lucide-react";
import Timer from "./Timer";
import ThemeToggle from "../common/ThemeToggle";
import QuestionNavigator from "./QuestionNavigator";
export function hasAnswer(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Boolean(value.code?.trim());
  return Boolean(String(value ?? "").trim());
}
export function ModernExamHeader({ a, t, name, seconds, connected, onSubmit }) {
  return <>
    <header className="em-header">
      <div className="em-identity"><div className="em-brand"><ShieldCheck size={24} /></div><div><span className="em-kicker">ASSESS / EXAM ROOM</span><h1>{a.title}</h1></div></div>
      <div className={`em-clock ${seconds < 60 ? "is-urgent" : ""}`} role="timer" aria-label="Time remaining"><Clock3 size={19} /><div><span>TIME REMAINING</span><Timer seconds={seconds} /></div></div>
      <div className="em-header-actions"><span className="em-student"><span>{name?.trim().charAt(0) || "S"}</span>{name}</span><button className="btn em-submit" onClick={onSubmit}>Submit assessment <Check size={16} /></button></div>
    </header>
    <div className="em-statusbar"><div className="em-session-status"><span className={connected ? "em-connected" : "em-disconnected"}>{connected ? <Wifi size={14} /> : <WifiOff size={14} />}{connected ? "Connected" : "Connection lost"}</span><span><ShieldCheck size={14} /> Warnings <strong>{t.warningCount} / {a.securitySettings.maxWarnings}</strong></span></div><ThemeToggle /></div>
  </>;
}
export function ModernExamProgress({ a, answers, current, onNavigate, status, answered, marked, sections }) {
  const percent = a.questions.length ? Math.round(answered / a.questions.length * 100) : 0;
  return <>
    <div className="em-sidebar-heading"><span className="em-kicker">YOUR PROGRESS</span><span className="em-progress-percent">{percent}%</span></div>
    <h2>{answered}<span> / {a.questions.length}</span></h2><p className="em-progress-caption">questions answered</p>
    <div className="em-progress-track" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={a.questions.length} aria-valuenow={answered}><span style={{ width: `${percent}%` }} /></div>
    <div className="em-counts"><div><strong>{a.questions.length - answered}</strong><span>Unanswered</span></div><div><strong>{marked}</strong><span>For review</span></div></div>
    <div className="em-map-heading"><h3>Question map</h3><span>{String(a.questions.length).padStart(2, "0")}</span></div>
    {sections.map((section) => <section className="em-question-section" key={section.id} aria-label={`${section.label} questions`}>
      {sections.length > 1 && <div className="em-section-heading"><h4>{section.label}</h4><span>{section.indexes.filter((i) => hasAnswer(answers[a.questions[i]._id]?.value)).length} / {section.indexes.length} answered</span></div>}
      <QuestionNavigator questions={section.indexes.map((i) => a.questions[i])} indexes={section.indexes} labelPrefix={sections.length > 1 ? `${section.label} question` : "Question"} answers={answers} current={current} onChange={onNavigate} />
    </section>)}
    <div className="em-legend"><span><i className="done" />Answered</span><span><i className="now" />Current</span><span><Flag size={12} />For review</span><span><i />Unanswered</span></div>
    <div className={`em-save ${status === "Saved" ? "is-saved" : ""}`} role="status"><CheckCircle2 size={18} /><div><strong>{status === "Saved" ? "All changes saved" : status}</strong><span>Keep your focus. We’ll save your work.</span></div></div>
  </>;
}

