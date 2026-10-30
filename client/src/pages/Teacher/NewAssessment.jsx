import { updateAssessmentTiming } from "../../utils/assessmentTiming";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardList, Code2, Layers3, Clock3, ShieldCheck, Users, BookOpen, CheckCircle2 } from "lucide-react";
import { api, errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import AssessmentQuestionPicker, { questionCount } from "../../components/teacher/AssessmentQuestionPicker";
import SecuritySettings, { defaultSecurity } from "../../components/teacher/SecuritySettings";

const steps = ["The basics", "Choose questions", "Assessment rules", "Review & save"];
const types = [["QUIZ", "Quiz", "MCQs and knowledge checks", ClipboardList], ["CODING", "Coding", "Programming challenges", Code2], ["MIXED", "Mixed", "The best of both formats", Layers3]];
const initial = { title: "", description: "", instructions: "", type: "QUIZ", duration: 60, status: "DRAFT", startTime: null, endTime: null, questionIds: [], questionSetIds: [], securitySettings: defaultSecurity, randomizeQuestions: false, randomizeOptions: false, publishResults: false, aiEnabled: false, aiRubric: "Assess code quality, readability and algorithmic efficiency.", maxCodeRuns: 0 };
const localDate = (value) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

export default function NewAssessment() {
  const [form, setForm] = useState(() => structuredClone(initial));
  const [sets, setSets] = useState([]), [bank, setBank] = useState([]), [students, setStudents] = useState([]);
  const [step, setStep] = useState(0), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const [assigned, setAssigned] = useState([]), [studentSearch, setStudentSearch] = useState(""), [studentSections, setStudentSections] = useState([]);
  const pending = useRef(false), createdId = useRef(null), formElement = useRef(null), heading = useRef(null);
  const nav = useNavigate(), location = useLocation(), toast = useToast();
  const reuseSourceId = useRef(location.state?.reuseAssessmentId || null);
  const total = questionCount(sets, form);
  const selectedSets = form.questionSetIds.map((id) => {
    const saved = sets.find((set) => set._id === id);
    if (saved) return saved;
    const snapshot = (form.questionSets || []).find((set) => String(set.setId) === id);
    return snapshot && {
      ...snapshot,
      _id: id,
      totalMarks: (form.questions || []).filter((question) => String(question.sourceSetId) === id).reduce((sum, question) => sum + (question.marks || 0), 0),
    };
  }).filter(Boolean);
  const selectedIndividualQuestions = form.questionIds
    .map((id) => bank.find((question) => question._id === id) || form.questions?.find((question) => question._id === id))
    .filter(Boolean);
  const selectedQuizCount = selectedSets.filter((item) => item.type !== "CODING").reduce((sum, item) => sum + (item.questionCount || 0), 0)
    + selectedIndividualQuestions.filter((question) => question.type !== "CODING").length;
  const selectedCodingCount = selectedSets.filter((item) => item.type === "CODING").reduce((sum, item) => sum + (item.questionCount || 0), 0)
    + selectedIndividualQuestions.filter((question) => question.type === "CODING").length;
  const questionDeliveryOptions = [
    ...(form.type === "QUIZ" || selectedQuizCount > 0 || selectedCodingCount > 1 ? [["randomizeQuestions", "Shuffle question order", "Give students a different order of questions."]] : []),
    ...(form.type === "QUIZ" || selectedQuizCount > 0 ? [["randomizeOptions", "Shuffle answer options", "Randomize the options within each multiple-choice question."]] : []),
  ];
  const points = selectedSets.reduce((sum, set) => sum + (set.totalMarks || 0), 0) + form.questionIds.reduce((sum, id) => sum + (bank.find((q) => q._id === id)?.marks || form.questions?.find((q) => q._id === id)?.marks || 0), 0);
  const sections = [...new Set(students.map((student) => student.section).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const visibleStudents = students.filter((student) =>
    studentSections.includes(student.section) &&
    `${student.name} ${student.uid} ${student.course} ${student.section}`.toLowerCase().includes(studentSearch.toLowerCase()),
  ).sort((left, right) => String(left.uid || "").localeCompare(String(right.uid || ""), undefined, { numeric: true, sensitivity: "base" }));
  const toggleSectionFilter = (section) => setStudentSections((current) =>
    current.includes(section) ? current.filter((item) => item !== section) : [...current, section],
  );
  const set = (key, value) => setForm((previous) => updateAssessmentTiming(previous, key, value));
  async function load() {
    setLoading(true); setLoadError("");
    try {
      const [q, library, roster, template] = await Promise.all([
        api.get("/questions"), api.get("/question-sets"), api.get("/students"),
        ...(reuseSourceId.current ? [api.get("/assessments/" + reuseSourceId.current)] : []),
      ]);
      setBank(q.data); setSets(library.data); setStudents(roster.data);
      if (template) {
        const source = template.data;
        setForm({
          ...structuredClone(initial),
          title: `${source.title} (Copy)`,
          description: source.description || "",
          instructions: source.instructions || "",
          type: source.type,
          duration: source.duration,
          status: "DRAFT",
          startTime: null,
          endTime: null,
          questionIds: (source.questions || []).filter((question) => !question.sourceSetId).map((question) => question._id),
          questionSetIds: (source.questionSets || []).map((set) => String(set.setId)),
          questionSets: source.questionSets || [],
          questions: source.questions || [],
          securitySettings: source.securitySettings || defaultSecurity,
          randomizeQuestions: Boolean(source.randomizeQuestions),
          randomizeOptions: Boolean(source.randomizeOptions),
          publishResults: false,
          aiEnabled: Boolean(source.aiEnabled),
          aiRubric: source.aiRubric || initial.aiRubric,
          maxCodeRuns: source.maxCodeRuns || 0,
        });
      }
    } catch (e) { setLoadError(errorMessage(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const refreshQuestions = useCallback(async () => {
    const [questions, library] = await Promise.all([api.get("/questions"), api.get("/question-sets")]);
    setBank(questions.data); setSets(library.data);
  }, []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [step]);
  function selectType(type) {
    setForm((previous) => ({ ...previous, type,
      questionSetIds: previous.questionSetIds.filter((id) => sets.some((item) => item._id === id && (type === "MIXED" || item.type === type))),
      questionIds: previous.questionIds.filter((id) => bank.some((q) => q._id === id && (type === "MIXED" || (type === "CODING" ? q.type === "CODING" : q.type !== "CODING")))),
    }));
  }
  function validate(index) {
    if (index === 0 && (!form.title.trim() || form.title.length > 200)) return "Give your assessment a title (up to 200 characters).";
    if (index === 1 && (!total || total > 100)) return "Select between 1 and 100 questions from your saved sets or individual questions.";
    if (index === 2) {
      if (!Number.isInteger(form.duration) || form.duration < 1 || form.duration > 480) return "Choose a duration between 1 and 480 minutes.";
      if (form.startTime && form.endTime && new Date(form.endTime) <= new Date(form.startTime)) return "The closing time must be after the earliest start time.";
      if (!Number.isInteger(form.securitySettings.maxWarnings) || form.securitySettings.maxWarnings < 1 || form.securitySettings.maxWarnings > 100) return "Choose between 1 and 100 maximum warnings.";
      if (!Number.isInteger(form.maxCodeRuns) || form.maxCodeRuns < 0 || form.maxCodeRuns > 1000) return "Code runs must be between 0 and 1000.";
    }
    return "";
  }
  function moveTo(next) {
    if (saving) return;
    if (next > step) {
      if (!formElement.current.reportValidity()) return;
      for (let index = 0; index < next; index++) {
        const message = validate(index);
        if (message) { setStep(index); setError(message); return; }
      }
    }
    setError(""); setStep(next);
  }
  async function submit(event) {
    event.preventDefault();
    if (step < 3) { moveTo(step + 1); return; }
    if (pending.current) return;
    for (let index = 0; index < 3; index++) {
      const message = validate(index);
      if (message) { setStep(index); setError(message); return; }
    }
    pending.current = true; setSaving(true); setError("");
    try {
      const payload = { ...form, securitySettings: { ...form.securitySettings, warningAction: "AUTO_SUBMIT" } };
      // Reuse an already created draft if assigning students needs a retry.
      const { data } = createdId.current
        ? await api.put("/assessments/" + createdId.current, payload)
        : reuseSourceId.current
          ? await api.post(`/assessments/${reuseSourceId.current}/reuse`, payload)
          : await api.post("/assessments", payload);
      createdId.current = data._id;
      await api.post("/assessments/" + data._id + "/assign", { studentIds: assigned });
      toast("Assessment saved successfully. Generate an access code when you’re ready to invite students.", { success: true });
      nav("/teacher/assessments/" + data._id);
    } catch (e) {
      setError((createdId.current ? "Your assessment is saved, but setup is not complete. Retry to finish without creating a duplicate. " : "") + errorMessage(e));
    } finally { pending.current = false; setSaving(false); }
  }
  if (loading) return <div className="assessment-setup"><div className="as-panel as-loading" role="status">Preparing your assessment studio…</div></div>;
  if (loadError) return <div className="assessment-setup"><div className="as-panel as-loading" role="alert"><p>{loadError}</p><Button onClick={load}>Try again</Button></div></div>;
  return (
    <div className="assessment-setup">
      <div className="as-topline"><Link className="as-back" to="/teacher/assessments"><ArrowLeft size={16} /> All assessments</Link><span className="as-draft-label">{createdId.current ? "Saved · finish setup" : reuseSourceId.current ? "Reusable copy" : "New assessment"}</span></div>
      <header className="as-heading"><div><span className="ah-kicker">ASSESSMENT STUDIO</span><h1>{reuseSourceId.current ? "Reuse assessment" : "Create assessment"}</h1><p>{reuseSourceId.current ? "Review the copied setup, choose students, and save your new run." : "Set the basics, choose questions, then review before saving."}</p></div></header>
      <nav className="as-steps" aria-label="Assessment setup steps">
        {steps.map((label, index) => <button type="button" key={label} disabled={saving} className={step === index ? "active" : step > index ? "complete" : ""} aria-current={step === index ? "step" : undefined} onClick={() => moveTo(index)}><span>{step > index ? <Check size={16} /> : `0${index + 1}`}</span><strong>{label}</strong></button>)}
      </nav>
      <section className="as-summary-bar" aria-label="Assessment summary">
        <div className="as-summary-bar-title"><span className={`ah-status status-${form.status.toLowerCase()}`}><i />{form.status === "DRAFT" ? "Draft" : "Scheduled"}</span><strong>{form.title || "Untitled assessment"}</strong></div>
        <div className="as-summary-bar-stats"><span><strong>{total}</strong> questions</span><span><strong>{points}</strong> marks</span><span><strong>{form.duration || "—"}</strong> min</span></div>
      </section>
      <div className="as-workspace">
        <form id="assessment-setup-form" ref={formElement} onSubmit={submit} className="as-main">
          <fieldset disabled={saving}>
              <section className={`as-panel as-step-panel${step === 2 ? " as-rules-panel" : ""}${step === 3 ? " as-final-step" : ""}`} key={step}>
              <div className="as-panel-heading"><span className="as-section-number">STEP 0{step + 1}</span><h2 tabIndex={-1} ref={heading}>{["Let’s start with the basics", "Curate the right questions", "Set the ground rules", "One last look"][step]}</h2>{step !== 2 && <p>{["Give this assessment a name and choose how students will be challenged.", "Bring in content you’ve already prepared in the Question Bank.", "Choose the timing and controls that fit your classroom.", "Review your setup and choose who can take this assessment."][step]}</p>}</div>
              {step === 0 && <>
                <Input label="Assessment title" placeholder="e.g. Data structures · Midterm quiz" required maxLength={200} value={form.title} onChange={(e) => set("title", e.target.value)} />
                <fieldset className="as-type-selector"><legend>Assessment format</legend><div className="as-type-grid">{types.map(([value, label, description, Icon]) => <label className={form.type === value ? "selected" : ""} key={value}><input type="radio" name="assessment-format" value={value} checked={form.type === value} onChange={() => selectType(value)} /><Icon size={24} /><strong>{label}</strong><small>{description}</small><span className="as-type-check"><Check size={12} /></span></label>)}</div></fieldset>
                {!!total && <small className="as-selection-note">Changing format keeps compatible questions and removes the others.</small>}
                <label className="field">Description <span className="as-optional">Optional</span><textarea rows={3} placeholder="What should students know about this assessment?" value={form.description} maxLength={20000} onChange={(e) => set("description", e.target.value)} /></label>
                <details className="as-disclosure"><summary>Instructions for students</summary><label className="field">Instructions<textarea rows={4} placeholder="Add any instructions students should read before starting." value={form.instructions} maxLength={20000} onChange={(e) => set("instructions", e.target.value)} /></label></details>
              </>}
              {step === 1 && <AssessmentQuestionPicker showHeading={false} sets={sets} bank={bank} form={form} onChange={setForm} onRefresh={refreshQuestions} />}
              {step === 2 && <>
                <div className="as-subheading"><Clock3 size={19} /><h3>Timing & availability</h3></div>
                <div className="form-grid"><Input label="Duration (minutes)" type="number" required min={1} max={480} value={form.duration} onChange={(e) => set("duration", e.target.value === "" ? "" : Number(e.target.value))} /><label className="field">Save as<select value={form.status} onChange={(e) => set("status", e.target.value)}><option value="DRAFT">Draft · prepare for later</option><option value="SCHEDULED">Scheduled · allow lobby access</option></select></label></div>
                <details className="as-disclosure"><summary>Schedule the assessment <span>Optional</span></summary><div className="form-grid">{[["startTime", "Scheduled start time"], ["endTime", "Hard closing time"]].map(([key, label]) => <Input key={key} label={label} type="datetime-local" readOnly={key === "endTime" && Boolean(form.startTime)} value={localDate(form[key])} onChange={(e) => set(key, e.target.value ? new Date(e.target.value).toISOString() : null)} />)}</div><small>Hard close is calculated from the start time plus duration. Save as Scheduled, assign students and generate an access code before the start. Without a start time, you can start manually.</small></details>
                <div className="as-subheading"><ShieldCheck size={19} /><h3>Assessment integrity</h3></div>
                <SecuritySettings value={form.securitySettings} onChange={(value) => set("securitySettings", value)} />
                {!!questionDeliveryOptions.length && <>
                  <div className="as-subheading"><Layers3 size={19} /><h3>Question delivery</h3></div>
                  <div className="as-option-stack">{questionDeliveryOptions.map(([key, label, description]) => <label key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} /></label>)}</div>
                </>}
                {form.type !== "QUIZ" && <details className="as-disclosure"><summary>Coding & AI review settings</summary><Input label="Code runs per student (leave blank for unlimited)" type="number" min={0} max={1000} value={form.maxCodeRuns || ""} onChange={(e) => set("maxCodeRuns", Number(e.target.value))} /><label className="check"><input type="checkbox" checked={form.aiEnabled} onChange={(e) => set("aiEnabled", e.target.checked)} />Enable teacher-reviewed AI feedback</label>{form.aiEnabled && <label className="field">AI rubric<textarea value={form.aiRubric} onChange={(e) => set("aiRubric", e.target.value)} /></label>}</details>}
              </>}
              {step === 3 && <>
                <div className="as-review-banner"><CheckCircle2 size={26} /><div><strong>{form.title}</strong><span>{form.type === "QUIZ" ? "Quiz" : form.type === "CODING" ? "Coding" : "Mixed"} · {total} questions · {form.duration} minutes</span></div><button type="button" onClick={() => moveTo(0)}>Edit</button></div>
                <h3>Selected content</h3><div className="as-review-sets">{selectedSets.map((item) => <div key={item._id}><BookOpen size={17} /><span>{item.title}</span><small>{item.questionCount} questions</small></div>)}{!!form.questionIds.length && <div><BookOpen size={17} /><span>Individual bank questions</span><small>{form.questionIds.length} questions</small></div>}</div>
                <div className="as-subheading"><Users size={19} /><h3>Assign students <span className="as-optional">Optional</span></h3></div><p className="as-help">Select students now, or assign them after saving.</p>
                {!!sections.length && <details className="as-section-filter"><summary><span><strong>Filter by section</strong><small>{studentSections.length ? studentSections.join(", ") : "No section selected · choose sections to view students"}</small></span><ChevronDown size={17} /></summary><div className="as-section-filter-options"><button type="button" className="as-section-filter-action" onClick={() => setStudentSections(sections)}>Select all sections</button>{sections.map((section) => <label key={section} className={studentSections.includes(section) ? "is-selected" : ""}><input type="checkbox" checked={studentSections.includes(section)} onChange={() => toggleSectionFilter(section)} /><span>{section}</span></label>)}{studentSections.length > 0 && <button type="button" className="as-section-filter-clear" onClick={() => setStudentSections([])}>Clear section filter</button>}</div></details>}
                <div className="form-grid as-student-search-grid"><label className="field">Search students<input aria-label="Search students to assign" placeholder="Name, UID or course…" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} /></label></div>
                {!!visibleStudents.length && <div className="row wrap"><Button type="button" variant="secondary" onClick={() => setAssigned((previous) => [...new Set([...previous, ...visibleStudents.map((student) => student._id)])])}>Select all shown ({visibleStudents.length})</Button>{!!assigned.length && <Button type="button" variant="secondary" onClick={() => setAssigned([])}>Clear selection</Button>}</div>}
                <div className="as-student-list">{visibleStudents.map((s) => <label key={s._id}><input type="checkbox" checked={assigned.includes(s._id)} onChange={(e) => setAssigned(e.target.checked ? [...assigned, s._id] : assigned.filter((id) => id !== s._id))} /><span><strong>{s.name}</strong><small>{s.uid} · {s.course} · {s.section}</small></span></label>)}{!students.length && <p>No students yet. You can assign them from the saved assessment later.</p>}{students.length > 0 && !studentSections.length && <p>Select a section above to view its students.</p>}{students.length > 0 && !!studentSections.length && !visibleStudents.length && <p>No students match the selected section and search.</p>}</div>
                <p className="as-help">{assigned.length} students selected. Generate an access code after saving. A Scheduled assessment with a start time launches automatically once students are assigned and a code is ready.</p>
              </>}
              {error && <p className="notice error" role="alert">{error}</p>}
              <footer className="as-step-footer"><Button type="button" variant="secondary" disabled={step === 0 || saving} onClick={() => moveTo(step - 1)}><ArrowLeft size={16} /> Back</Button><span>{step + 1} of 4</span><Button type="submit" disabled={saving}>{saving ? "Saving…" : step === 3 ? "Save assessment" : "Continue"}{step === 3 ? <Check size={16} /> : <ArrowRight size={16} />}</Button></footer>
            </section>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
