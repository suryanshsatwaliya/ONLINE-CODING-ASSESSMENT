import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Modal from "../../components/common/Modal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import CreateQuestionMenu from "../../components/teacher/CreateQuestionMenu";
import Badge from "../../components/common/Badge";
import QuestionBuilder from "../../components/teacher/QuestionBuilder";
export default function QuestionBank() {
  const [rows, R] = useState([]),
    [sets, setSets] = useState([]),
    [q, Q] = useState(null),
    [search, S] = useState(""),
    [type, T] = useState(""),
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
        <CreateQuestionMenu />
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
      <div className="grid two">
        {sets.filter((set) => (!type || set.type === type) && (set.title + " " + set.description).toLowerCase().includes(search.toLowerCase())).map((set) => (
          <article className="card bank-set-card" key={set._id}>
            <div className="row between"><Badge>{set.type === "QUIZ" ? "QUIZ · MCQ" : "CODING SET"}</Badge><small>{set.questionCount} questions</small></div>
            <h2>{set.title}</h2>
            <p>{set.description || (set.type === "QUIZ" ? "A reusable quiz, ready when you need it." : "A reusable collection of coding problems.")}</p>
            <div className="row between wrap"><span className="muted">{set.totalMarks} points{!set.readyForAssessment && " · Needs hidden grading tests"}</span>
              <div className="row"><Link to={"/teacher/questions/sets/" + set._id}>Edit {set.type === "QUIZ" ? "quiz" : "set"}</Link>
                <button className="danger-text" onClick={() => D({ ...set, isSet: true })}>Delete</button></div>
            </div>
          </article>
        ))}
      </div>
      {!!rows.length && <h2 className="bank-legacy-heading">Individual questions</h2>}
      <div className="grid two">
        {rows
          .filter(
            (q) =>
              (q.title + q.tags.join(" "))
                .toLowerCase()
                .includes(search.toLowerCase()) &&
              (!type || (type === "CODING" ? q.type === "CODING" : q.type !== "CODING")),
          )
          .map((q) => (
            <div className="card" key={q._id}>
              <div className="row between">
                <Badge>{q.type}</Badge>
                <span>{q.marks} marks</span>
              </div>
              <h2>{q.title}</h2>
              <p>{q.question || q.description}</p>
              <div className="row">
                <button onClick={() => Q(q)}>Edit question</button>
                <button className="danger-text" onClick={() => D(q)}>
                  Delete
                </button>
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
