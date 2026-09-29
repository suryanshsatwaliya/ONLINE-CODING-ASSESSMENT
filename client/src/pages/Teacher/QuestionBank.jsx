import { useEffect, useState } from "react";
import { api, errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Modal from "../../components/common/Modal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import QuestionBuilder, {
  blankQuestion,
} from "../../components/teacher/QuestionBuilder";
import { questionTypes } from "../../utils/constants";
export default function QuestionBank() {
  const [rows, R] = useState([]),
    [q, Q] = useState(null),
    [search, S] = useState(""),
    [type, T] = useState(""),
    [del, D] = useState(null);
  const toast = useToast();
  const load = () =>
    api
      .get("/questions")
      .then((r) => R(r.data))
      .catch((e) => toast(errorMessage(e)));
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
      toast("Question saved");
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
          <p>Curate questions once. Use them across assessments.</p>
        </div>
        <Button onClick={() => Q(structuredClone(blankQuestion))}>
          + Create question
        </Button>
      </div>
      <div className="filters">
        <input
          placeholder="Search title or tags…"
          value={search}
          onChange={(e) => S(e.target.value)}
        />
        <select value={type} onChange={(e) => T(e.target.value)}>
          <option value="">All types</option>
          {questionTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="grid two">
        {rows
          .filter(
            (q) =>
              (q.title + q.tags.join(" "))
                .toLowerCase()
                .includes(search.toLowerCase()) &&
              (!type || q.type === type),
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
      {!rows.length && (
        <div className="empty card">
          Create your first question, or run the seed script for original
          examples.
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
              await api.delete("/questions/" + del._id);
              D(null);
              load();
            } catch (e) {
              toast(errorMessage(e));
            }
          }}
        >
          Delete this bank question? Assessment snapshots are preserved.
        </ConfirmDialog>
      )}
    </>
  );
}
