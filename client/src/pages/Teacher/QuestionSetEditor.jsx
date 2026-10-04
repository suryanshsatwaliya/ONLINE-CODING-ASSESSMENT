import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { api, errorMessage } from "../../services/api";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { useToast } from "../../components/common/Toast";
import { blankQuestion } from "../../components/teacher/QuestionBuilder";
import QuizQuestionEditor from "../../components/teacher/QuizQuestionEditor";
import CodingProblemBuilder from "../../components/teacher/CodingProblemBuilder";
import LeetcodeImport from "../../components/teacher/LeetcodeImport";

const draft = (type) => ({ ...structuredClone(blankQuestion), type: type === "CODING" ? "CODING" : "SINGLE", draftId: crypto.randomUUID() });
export default function QuestionSetEditor() {
  const { id, kind } = useParams();
  const type = kind === "coding" ? "CODING" : "QUIZ";
  const nav = useNavigate(), toast = useToast();
  const [form, setForm] = useState(() => ({ title: "", description: "", type, questions: [draft(type)] }));
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false), [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const pending = useRef(false);
  const coding = form.type === "CODING";
  useEffect(() => {
    if (!id) return;
    let active = true;
    api.get("/question-sets/" + id).then(({ data }) => {
      if (active) setForm({ ...data, questions: data.questions.map((q) => ({ ...structuredClone(blankQuestion), ...q, draftId: crypto.randomUUID() })) });
    }).catch((e) => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = (update) => { setDirty(true); setForm(update); };
  const updateQuestion = (draftId, question) => change((previous) => ({ ...previous, questions: previous.questions.map((q) => q.draftId === draftId ? question : q) }));
  function move(index, direction) {
    change((previous) => {
      const questions = [...previous.questions];
      [questions[index], questions[index + direction]] = [questions[index + direction], questions[index]];
      return { ...previous, questions };
    });
  }
  async function save(event) {
    event.preventDefault();
    if (pending.current || importing) return;
    pending.current = true; setSaving(true); setError("");
    try {
      const { data } = id ? await api.put("/question-sets/" + id, form) : await api.post("/question-sets", form);
      setDirty(false);
      toast(coding ? "Coding set saved to Question Bank" : "Quiz saved to Question Bank");
      if (!id) nav("/teacher/questions/sets/" + data._id, { replace: true });
      else setForm((previous) => ({ ...previous, revision: data.revision }));
    } catch (e) {
      const issue = e.response?.data?.errors?.[0];
      setError((issue?.path?.[0] === "questions" ? `Question ${issue.path[1] + 1}: ` : "") + errorMessage(e));
    } finally { pending.current = false; setSaving(false); }
  }
  if (loading) return <p role="status">Loading question set…</p>;
  if (id && !form._id) return <div className="card"><p role="alert">{error || "Question set unavailable"}</p><Link to="/teacher/questions">Back to Question Bank</Link></div>;
  return (
    <div className="question-set-studio">
      <div className="page-title">
        <div><Link className="back-link" to="/teacher/questions">← Question Bank</Link>
          <h1>{id ? "Edit" : "Create"} {coding ? "coding set" : "quiz"}</h1>
          <p>Build once. Save to your bank. Reuse whenever you need.</p>
        </div>
        <span className="studio-status">{dirty ? "Unsaved changes" : id ? "Saved in Question Bank" : "New question set"}</span>
      </div>
      <form onSubmit={save}>
        <fieldset disabled={saving || importing}>
          <section className="card set-title-card">
            <Input label={coding ? "Question set title" : "Quiz title"} placeholder={coding ? "e.g. Strings & arrays" : "e.g. Data structures · Week 1"} required maxLength={200}
              value={form.title} onChange={(e) => change({ ...form, title: e.target.value })} />
            <label className="field">Description (optional)
              <textarea rows={2} placeholder="A little context for this question set" value={form.description} onChange={(e) => change({ ...form, description: e.target.value })} />
            </label>
          </section>
          {form.questions.map((q, index) => (
            <section className="card form-question-card" key={q.draftId} aria-label={`Question ${index + 1}`}>
              <div className="row between question-card-toolbar">
                <span className="question-number">{index + 1}</span>
                <div className="row question-tools">
                  <button type="button" aria-label={`Move question ${index + 1} up`} title="Move up" disabled={!index} onClick={() => move(index, -1)}><ArrowUp size={18} /></button>
                  <button type="button" aria-label={`Move question ${index + 1} down`} title="Move down" disabled={index === form.questions.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /></button>
                  <button type="button" aria-label={`Duplicate question ${index + 1}`} title="Duplicate question" disabled={form.questions.length >= 100}
                    onClick={() => change((previous) => ({ ...previous, questions: [...previous.questions.slice(0, index + 1), { ...structuredClone(q), draftId: crypto.randomUUID() }, ...previous.questions.slice(index + 1)] }))}><Copy size={18} /></button>
                  <button type="button" className="danger-text" aria-label={`Delete question ${index + 1}`} title="Delete question" disabled={form.questions.length === 1}
                    onClick={() => change((previous) => ({ ...previous, questions: previous.questions.filter((item) => item.draftId !== q.draftId) }))}><Trash2 size={18} /></button>
                </div>
              </div>
              {coding ? <>
                <LeetcodeImport value={q} onChange={(updated) => updateQuestion(q.draftId, updated)} onBusy={setImporting} />
                <div className="form-grid">
                  <Input label="Problem title" required maxLength={200} value={q.title} onChange={(e) => updateQuestion(q.draftId, { ...q, title: e.target.value })} />
                  <Input label="Points" type="number" required min="0.1" max="1000" step="0.1" value={q.marks || ""} onChange={(e) => updateQuestion(q.draftId, { ...q, marks: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
                {q.externalReference.startsWith("https://leetcode.com/problems/") && <p className="source-reference">Imported from <a href={q.externalReference} target="_blank" rel="noreferrer">LeetCode ↗</a> · All fields remain editable.</p>}
                <CodingProblemBuilder value={q} onChange={(updated) => updateQuestion(q.draftId, updated)} />
              </> : <QuizQuestionEditor value={q} onChange={(updated) => updateQuestion(q.draftId, updated)} />}
            </section>
          ))}
          <Button type="button" variant="secondary" className="add-question-wide" disabled={form.questions.length >= 100}
            onClick={() => change((previous) => ({ ...previous, questions: [...previous.questions, draft(previous.type)] }))}>+ Add {coding ? "coding question" : "question"}</Button>
          {error && <p className="error notice" role="alert">{error}</p>}
          <div className="set-save-bar">
            <span>{form.questions.length} question{form.questions.length === 1 ? "" : "s"} · {form.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)} points</span>
            <Button disabled={saving || importing}>{saving ? "Saving…" : coding ? "Save coding set" : "Save quiz"}</Button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
