export default function ViolationLog({ events }) {
  return (
    <div className="timeline">
      {events.map((e) => (
        <div key={e._id}>
          <span className="timeline-dot" />
          <small>{new Date(e.timestamp).toLocaleTimeString()}</small>
          <strong>{e.eventType.replaceAll("_", " ")}</strong>
          <p>
            {e.warningIssued
              ? "Warning " + e.warningCountAfterEvent
              : "Logged event"}
          </p>
        </div>
      ))}
      {!events.length && <p>No events recorded.</p>}
    </div>
  );
}
