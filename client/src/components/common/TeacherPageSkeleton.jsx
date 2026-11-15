export default function TeacherPageSkeleton({ type, label }) {
  if (type === "assessments") return <div className="teacher-page-skeleton assessment-skeleton" role="status" aria-label={label || "Loading assessments"}>
    <div className="ah-cards">{[0, 1, 2].map((item) => <div className="teacher-skeleton-card" key={item}><i /><b /><b /><span /><span /></div>)}</div>
  </div>;

  if (type === "question-bank") return <div className="teacher-page-skeleton question-bank-skeleton" role="status" aria-label={label || "Loading question bank"}>
    <div className="grid question-bank-grid">{[0, 1, 2, 3].map((item) => <div className="teacher-skeleton-card" key={item}><i /><b /><span /><span /><span /></div>)}</div>
  </div>;

  if (type === "submissions") return <div className="teacher-page-skeleton submissions-skeleton" role="status" aria-label={label || "Loading student submissions"}>
    <div className="submission-skeleton-table"><div className="submission-skeleton-head">{[0, 1, 2, 3, 4, 5].map((item) => <i key={item} />)}</div>{[0, 1, 2, 3, 4].map((row) => <div className="submission-skeleton-row" key={row}>{[0, 1, 2, 3, 4, 5].map((cell) => <i key={cell} />)}</div>)}</div>
  </div>;

  if (type === "monitor") return <div className="teacher-page-skeleton monitor-skeleton" role="status" aria-label={label || "Loading live assessment"}>
    <div className="monitor-skeleton-metrics">{[0, 1, 2].map((item) => <div className="teacher-skeleton-card" key={item}><i /><b /></div>)}</div>
    <div className="teacher-skeleton-card monitor-skeleton-roster"><b /><span /><span /><span /></div>
  </div>;

  return null;
}
