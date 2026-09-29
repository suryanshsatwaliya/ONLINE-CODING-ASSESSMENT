import { useEffect, useState } from "react";
import { api, errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import ResultTable from "../../components/teacher/ResultTable";
import Modal from "../../components/common/Modal";
export default function Results() {
  const [assessments, A] = useState([]),
    [id, I] = useState(""),
    [rows, R] = useState([]),
    [search, S] = useState(""),
    [status, St] = useState(""),
    [sort, Sort] = useState("score"),
    [detail, D] = useState(null);
  const toast = useToast();
  useEffect(() => {
    api
      .get("/assessments")
      .then((r) => {
        A(r.data);
        I(r.data[0]?._id || "");
      })
      .catch((e) => toast(errorMessage(e)));
  }, []);
  useEffect(() => {
    if (id)
      api
        .get("/results/" + id)
        .then((r) => R(r.data))
        .catch((e) => toast(errorMessage(e)));
  }, [id]);
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">LEARNING INSIGHTS</span>
          <h1>Results & analytics</h1>
          <p>Deterministic scores with separately approved AI rubric marks.</p>
        </div>
      </div>
      <div className="filters">
        <select value={id} onChange={(e) => I(e.target.value)}>
          <option value="">Select assessment</option>
          {assessments.map((a) => (
            <option value={a._id} key={a._id}>
              {a.title}
            </option>
          ))}
        </select>
        <input
          placeholder="Search student or UID…"
          value={search}
          onChange={(e) => S(e.target.value)}
        />
        <select value={status} onChange={(e) => St(e.target.value)}>
          <option value="">All statuses</option>
          <option>SUBMITTED</option>
          <option>EXPIRED</option>
          <option>TERMINATED</option>
        </select>
        <select value={sort} onChange={(e) => Sort(e.target.value)}>
          <option value="score">Highest score</option>
          <option value="name">Student name</option>
        </select>
      </div>
      <div className="stats">
        <div className="stat card">
          <span>Submissions</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="stat card">
          <span>Average score</span>
          <strong>
            {rows.length
              ? (
                  rows.reduce((s, r) => s + r.percentage, 0) / rows.length
                ).toFixed(1) + "%"
              : "—"}
          </strong>
        </div>
        <div className="stat card">
          <span>Pending grading</span>
          <strong>{rows.filter((r) => r.status === "PENDING").length}</strong>
        </div>
      </div>
      <div className="card">
        <ResultTable
          rows={rows
            .filter(
              (r) =>
                (r.student?.name + r.student?.uid)
                  .toLowerCase()
                  .includes(search.toLowerCase()) &&
                (!status || r.attempt?.status === status),
            )
            .sort((a, b) =>
              sort === "score"
                ? b.totalScore - a.totalScore
                : a.student.name.localeCompare(b.student.name),
            )}
          onView={async (id) => {
            try {
              D((await api.get("/results/attempt/" + id)).data);
            } catch (e) {
              toast(errorMessage(e));
            }
          }}
        />
        {!rows.length && (
          <div className="empty">
            Results will appear after students submit.
          </div>
        )}
      </div>
      {detail && (
        <Modal
          title={detail.attempt.student.name + " · Submission details"}
          onClose={() => D(null)}
        >
          {detail.assessment.questions.map((q) => (
            <div className="test-builder" key={q._id}>
              <h3>{q.title}</h3>
              <pre>
                {JSON.stringify(
                  detail.attempt.answers?.[q._id]?.value ?? "Unanswered",
                  null,
                  2,
                )}
              </pre>
              <small>Reference answer: {JSON.stringify(q.correctAnswer)}</small>
            </div>
          ))}
          <h3>Coding execution records (teacher only)</h3>
          <pre>{JSON.stringify(detail.executions, null, 2)}</pre>
        </Modal>
      )}
    </>
  );
}
