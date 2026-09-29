import Badge from "../common/Badge";
export default function LiveStudentCard({ row, onClick }) {
  const { student: s, attempt: t } = row;
  return (
    <button className="card live-card" onClick={onClick}>
      <div className="row between">
        <span className="avatar">{s.name[0]}</span>
        <Badge>
          {!t
            ? "NOT_STARTED"
            : t.status === "ACTIVE" && !t.connected
              ? "DISCONNECTED"
              : t.status}
        </Badge>
      </div>
      <h3>{s.name}</h3>
      <p>{s.uid}</p>
      <div className="row between">
        <span>
          Warnings{" "}
          <strong>
            {t?.warningCount || 0} / {row.maxWarnings}
          </strong>
        </span>
        <span>
          {t?.status === "ACTIVE"
            ? Math.max(
                0,
                Math.ceil((new Date(t.expiresAt) - Date.now()) / 60000),
              ) + " min left"
            : "View history →"}
        </span>
      </div>
      <small style={{ marginTop: 12 }}>
        Last event:{" "}
        {row.lastEvent?.eventType?.replaceAll("_", " ") || "No events yet"}
      </small>
    </button>
  );
}
