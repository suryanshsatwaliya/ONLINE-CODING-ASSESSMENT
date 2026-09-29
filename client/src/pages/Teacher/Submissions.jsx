import { useEffect, useState } from "react";
import { api, errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
export default function Submissions() {
  const [rows, R] = useState([]),
    [selected, S] = useState(null),
    [review, V] = useState(null);
  const toast = useToast();
  const load = () =>
    api
      .get("/results/submissions")
      .then((r) => R(r.data))
      .catch((e) => toast(errorMessage(e)));
  useEffect(() => {
    load();
  }, []);
  async function open(s) {
    S(s);
    V(null);
    try {
      V((await api.get("/ai/" + s._id)).data);
    } catch (e) {
      toast(errorMessage(e));
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">CODE & FEEDBACK</span>
          <h1>Coding submissions</h1>
          <p>
            Review source, retry infrastructure failures and approve AI
            feedback.
          </p>
        </div>
        <Button variant="secondary" onClick={load}>
          Refresh
        </Button>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Language</th>
              <th>Status</th>
              <th>Correctness marks</th>
              <th>Submitted</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s._id}>
                <td>
                  {s.student?.name}
                  <small>{s.student?.uid}</small>
                </td>
                <td>{s.language}</td>
                <td>
                  <Badge>{s.status}</Badge>
                </td>
                <td>{s.score ?? "Pending"}</td>
                <td>{new Date(s.createdAt).toLocaleString()}</td>
                <td>
                  <button onClick={() => open(s)}>Open</button>
                  {s.status === "ERROR" && (
                    <button
                      onClick={async () => {
                        try {
                          await api.post("/results/retry/" + s._id);
                          load();
                        } catch (e) {
                          toast(errorMessage(e));
                        }
                      }}
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty">No coding submissions yet.</div>
        )}
      </div>
      {selected && (
        <Modal title="Review code submission" onClose={() => S(null)}>
          <pre>{selected.code}</pre>
          {selected.error && <p className="error">{selected.error}</p>}
          {review ? (
            <>
              <h3>AI review · {review.status}</h3>
              <p>{review.review.feedback}</p>
              <p>
                Quality {review.review.codeQuality}/10 · Efficiency{" "}
                {review.review.efficiency}/10 · Readability{" "}
                {review.review.readability}/10
              </p>
              <div className="form-grid">
                {["qualityScore", "efficiencyScore"].map((k) => (
                  <label className="field" key={k}>
                    {k}
                    <input
                      type="number"
                      min="0"
                      step=".1"
                      value={review[k]}
                      onChange={(e) => V({ ...review, [k]: +e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <div className="row">
                {["APPROVED", "REJECTED"].map((status) => (
                  <Button
                    key={status}
                    onClick={async () => {
                      try {
                        V(
                          (
                            await api.patch("/ai/" + review._id, {
                              qualityScore: review.qualityScore,
                              efficiencyScore: review.efficiencyScore,
                              status,
                            })
                          ).data,
                        );
                        toast("Review saved");
                      } catch (e) {
                        toast(errorMessage(e));
                      }
                    }}
                  >
                    {status === "APPROVED"
                      ? "Approve / override marks"
                      : "Reject review"}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <Button
              onClick={async () => {
                try {
                  V((await api.post("/ai/" + selected._id)).data);
                } catch (e) {
                  toast(errorMessage(e));
                }
              }}
            >
              Request optional AI review
            </Button>
          )}
          <p className="muted">
            AI cannot alter deterministic correctness marks. Only approved
            rubric marks contribute to the final result.
          </p>
        </Modal>
      )}
    </>
  );
}
