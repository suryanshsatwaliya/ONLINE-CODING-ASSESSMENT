import Badge from "../common/Badge";
import Button from "../common/Button";

export default function LiveStudentCard({ row, onHistory, onRestart, selected, onSelect, timeDisabled, restartDisabled }) {
  const { student: s, attempt: t } = row;
  const status = !t
    ? "Not started"
    : t.status === "ACTIVE"
      ? t.connected ? "In progress" : "Disconnected"
      : t.status === "SUBMITTED"
        ? "Submitted"
        : t.status === "TERMINATED"
          ? "Terminated"
          : t.status === "EXPIRED"
            ? "Expired"
            : t.status;
  const canRestart = ["SUBMITTED", "TERMINATED", "EXPIRED"].includes(t?.status);
  const timeLeft = t?.status === "ACTIVE"
    ? `${Math.max(0, Math.ceil((new Date(t.expiresAt) - Date.now()) / 60000))} min`
    : "—";
  return (
    <div className="live-student-row">
      <span className="live-student-select" data-label="Select">
        <input type="checkbox" aria-label={`Select ${s.name} for a time extension`} checked={selected}
          disabled={!t || t.status !== "ACTIVE" || timeDisabled} onChange={(event) => onSelect(s._id, event.target.checked)} />
      </span>
      <span className="live-student-identity">
        <span className="avatar">{s.name?.[0] || "S"}</span>
        <span><strong>{s.name}</strong><small>{s.uid}</small></span>
      </span>
      <span className="live-cell live-student-status" data-label="Status"><Badge>{status}</Badge></span>
      <span className="live-cell live-warning-count" data-label="Warnings">
        <strong>{t?.warningCount || 0} / {row.maxWarnings}</strong>
      </span>
      <span className="live-cell live-student-time" data-label="Time left">{timeLeft}</span>
      <span className="live-cell live-student-event" data-label="Last event">
        {row.lastEvent?.eventType?.replaceAll("_", " ") || "No events yet"}
      </span>
      <span className="live-student-actions">
        <Button variant="secondary" disabled={!t} onClick={() => onHistory(row)}>History</Button>
        <Button disabled={!canRestart || restartDisabled} onClick={() => onRestart(row)}>Restart</Button>
      </span>
    </div>
  );
}
