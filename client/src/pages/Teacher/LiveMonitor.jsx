import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import { useSocket } from "../../hooks/useSocket";
import LiveStudentCard from "../../components/teacher/LiveStudentCard";
import ViolationLog from "../../components/teacher/ViolationLog";
import Modal from "../../components/common/Modal";
export default function LiveMonitor() {
  const [assessments, A] = useState([]),
    [id, I] = useState(""),
    [rows, R] = useState([]),
    [events, E] = useState(null);
  const toast = useToast();
  const load = useCallback(() => {
    if (id)
      Promise.all([api.get("/assessments/" + id + "/monitor"), api.get("/assessments")])
        .then(([r, list]) => { R(r.data); A(list.data); })
        .catch((e) => toast(errorMessage(e)));
  }, [id]);
  const connected = useSocket(useCallback(() => load(), [load]));
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
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">REAL-TIME OVERSIGHT</span>
          <h1>Live monitor</h1>
          <p>Observable events are signals, not proof of misconduct.</p>
        </div>
        <span className="pill">
          <span className="dot" />
          {connected ? "Connected" : "Reconnecting…"}
        </span>
      </div>
      <select className="search" value={id} onChange={(e) => I(e.target.value)}>
        <option value="">Choose assessment</option>
        {assessments.map((a) => (
          <option value={a._id} key={a._id}>
            {a.title} · {a.status === "ENDED" ? "Completed" : a.status}
          </option>
        ))}
      </select>
      {assessments.find((a) => a._id === id)?.status === "ENDED" && <p className="notice" role="status">This assessment has ended. Student submissions are available for review.</p>}
      <div className="grid three">
        {rows.map((row) => (
          <LiveStudentCard
            row={row}
            key={row.student._id}
            onClick={async () => {
              if (!row.attempt) return;
              try {
                E({
                  name: row.student.name,
                  data: (
                    await api.get(
                      "/assessments/attempt/" + row.attempt._id + "/events",
                    )
                  ).data,
                });
              } catch (e) {
                toast(errorMessage(e));
              }
            }}
          />
        ))}
      </div>
      {!rows.length && (
        <div className="card empty">
          No assigned students in this assessment yet.
        </div>
      )}
      {events && (
        <Modal title={events.name + " · Event history"} onClose={() => E(null)}>
          <ViolationLog events={events.data} />
        </Modal>
      )}
    </>
  );
}
