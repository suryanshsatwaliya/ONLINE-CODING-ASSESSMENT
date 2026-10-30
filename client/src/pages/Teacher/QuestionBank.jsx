import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Code2, Grid2X2, List, ListChecks, PencilLine, Trash2 } from "lucide-react";
import { api, errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Modal from "../../components/common/Modal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import CreateQuestionMenu from "../../components/teacher/CreateQuestionMenu";
import Badge from "../../components/common/Badge";
import QuestionBuilder from "../../components/teacher/QuestionBuilder";

function setDescription(set) {
  const description = set.description?.trim();
  const boilerplate = /^a reusable (collection of coding problems|quiz, ready when you need it)\.?$/i;
  if (description && !boilerplate.test(description)) return description;
  return set.type === "CODING"
    ? `Solve the ${set.title} challenge and validate your solution with its test cases.`
    : "";
}

export default function QuestionBank() {
  const [rows, R] = useState([]),
    [sets, setSets] = useState([]),
    [q, Q] = useState(null),
    [search, S] = useState(""),
    [type, T] = useState(""),
    [view, setView] = useState("grid"),
    [del, D] = useState(null);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const load = () =>
    Promise.all([api.get("/questions"), api.get("/question-sets")])
      .then(([questions, questionSets]) => { R(questions.data); setSets(questionSets.data); setLoadError(""); })
      .catch((e) => setLoadError(errorMessage(e)))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  async function save(e) {
    e.preventDefault();
    try {
      q._id
        ? await api.put("/questions/" + q._id, q)
        : await api.post("/questions", q);
      Q(null);
      load();
      toast("Question saved successfully", { success: true });
    } catch (e) {
      toast(errorMessage(e));
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">REUSABLE LEARNING CONTENT</span>
          <h1>Question bank</h1>
          <p>Your reusable quizzes and coding sets. Create, edit and keep them here.</p>
        </div>
        <div className="question-bank-heading-actions">
          <div className="question-bank-view-toggle" role="group" aria-label="Question Bank layout">
            <button type="button" className={view === "grid" ? "is-active" : ""} aria-pressed={view === "grid"} onClick={() => setView("grid")} title="Grid view"><Grid2X2 size={16} /><span>Grid</span></button>
            <button type="button" className={view === "list" ? "is-active" : ""} aria-pressed={view === "list"} onClick={() => setView("list")} title="List view"><List size={17} /><span>List</span></button>
          </div>
          <CreateQuestionMenu />
        </div>
      </div>
      <div className="filters">
        <input
          aria-label="Search question bank"
          placeholder="Search quizzes, sets or questions…"
          value={search}
          onChange={(e) => S(e.target.value)}
        />
        <select aria-label="Question bank type" value={type} onChange={(e) => T(e.target.value)}>
          <option value="">All types</option>
          <option value="QUIZ">Quiz (MCQ)</option>
          <option value="CODING">Coding</option>
        </select>
      </div>
      {loading && <p role="status">Loading your question bank…</p>}
      {loadError && <div className="notice error" role="alert">{loadError} <button onClick={load}>Retry</button></div>}
      <div className={`grid question-bank-grid${view === "list" ? " is-list" : ""}`}>
        {sets.filter((set) => (!type || set.type === type) && (set.title + " " + set.description).toLowerCase().includes(search.toLowerCase())).map((set) => (
          <article className={`card bank-set-card ${set.type === "QUIZ" ? "is-quiz" : "is-coding"}`} key={set._id}>
            <div className="bank-card-heading">
              <span className="bank-card-icon">{set.type === "QUIZ" ? <ListChecks size={20} /> : <Code2 size={20} />}</span>
              <Badge className={`bank-type-badge ${set.type === "QUIZ" ? "is-quiz" : "is-coding"}`}>{set.type === "QUIZ" ? "QUIZ · MCQ" : "CODING SET"}</Badge>
              <span className="bank-question-count">{set.questionCount} {set.questionCount === 1 ? "question" : "questions"}</span>
            </div>
            <div className="bank-card-main">
              <h2>{set.title}</h2>
              {setDescription(set) && <p className="bank-card-description">{setDescription(set)}</p>}
            </div>
            <div className="bank-card-footer"><div className="bank-card-meta"><strong>{set.totalMarks}</strong><span>marks</span>{!set.readyForAssessment && <small>Needs hidden grading tests</small>}</div>
              <div className="bank-card-actions">
                <Link className="bank-action-edit" to={"/teacher/questions/sets/" + set._id}><PencilLine size={14} />Edit</Link>
                <button className="bank-action-delete" onClick={() => D({ ...set, isSet: true })}><Trash2 size={14} />Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!!rows.length && <h2 className="bank-legacy-heading">Individual questions</h2>}
      <div className={`grid question-bank-grid${view === "list" ? " is-list" : ""}`}>
        {rows
          .filter(
            (q) =>
              (q.title + q.tags.join(" "))
                .toLowerCase()
                .includes(search.toLowerCase()) &&
              (!type || (type === "CODING" ? q.type === "CODING" : q.type !== "CODING")),
          )
          .map((q) => (
            <div className={`card bank-question-card ${q.type === "CODING" ? "is-coding" : "is-quiz"}`} key={q._id}>
              <div className="bank-card-heading">
                <span className="bank-card-icon">{q.type === "CODING" ? <Code2 size={20} /> : <ListChecks size={20} />}</span>
                <Badge className={`bank-type-badge ${q.type === "CODING" ? "is-coding" : "is-quiz"}`}>{q.type === "CODING" ? "CODING" : "QUIZ · MCQ"}</Badge>
                <span className="bank-question-count">{q.marks} marks</span>
              </div>
              <div className="bank-card-main">
                <h2>{q.title}</h2>
                {(q.question || q.description) && <p className="bank-card-description">{q.question || q.description}</p>}
              </div>
              <div className="bank-card-actions">
                <button className="bank-action-edit" onClick={() => Q(q)}><PencilLine size={14} />Edit</button>
                <button className="bank-action-delete" onClick={() => D(q)}><Trash2 size={14} />Delete</button>
              </div>
            </div>
          ))}
      </div>
      {!loading && !loadError && !rows.length && !sets.length && (
        <div className="empty card">
          Choose Create Question → Quiz (MCQ) or Coding to build your first reusable set.
        </div>
      )}
      {q && (
        <Modal
          title={q._id ? "Edit question" : "Create question"}
          onClose={() => Q(null)}
        >
          <QuestionBuilder value={q} onChange={Q} onSubmit={save} />
        </Modal>
      )}
      {del && (
        <ConfirmDialog
          onClose={() => D(null)}
          onConfirm={async () => {
            try {
              await api.delete((del.isSet ? "/question-sets/" : "/questions/") + del._id);
              D(null);
              load();
            } catch (e) {
              toast(errorMessage(e));
            }
          }}
        >
          Delete “{del.title}” from the Question Bank? Existing assessments keep their saved copies.
        </ConfirmDialog>
      )}
    </>
  );
}
