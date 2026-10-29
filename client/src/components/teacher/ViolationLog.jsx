export default function ViolationLog({ events }) {
  const newestFirst = [...(events || [])].sort(
    (left, right) => new Date(right.timestamp) - new Date(left.timestamp),
  );

  return (
    <div className="timeline history-timeline" aria-label="Student event history">
      {newestFirst.map((event) => (
        <article className={`history-event${event.warningIssued ? " is-warning" : ""}`} key={event._id}>
          <span className="timeline-dot" aria-hidden="true" />
          <div className="history-event-meta">
            <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString()}</time>
            <span className="history-event-tag">
              {event.warningIssued ? `Warning ${event.warningCountAfterEvent}` : "Logged"}
            </span>
          </div>
          <strong>{event.eventType.replaceAll("_", " ")}</strong>
          <p>{event.warningIssued ? "A warning was issued for this event." : "Activity recorded"}</p>
        </article>
      ))}
      {!newestFirst.length && <p className="history-empty">No events recorded.</p>}
    </div>
  );
}
