import Badge from "../common/Badge";
export default function ResultTable({ rows, onView }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {[
              "Student",
              "Quiz",
              "Coding",
              "AI",
              "Total",
              "Percentage",
              "Warnings",
              "Status",
              "Submitted",
              "",
            ].map((x, i) => (
              <th key={i}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td>
                <strong>{r.student?.name}</strong>
                <small>{r.student?.uid}</small>
              </td>
              <td>{r.quizScore}</td>
              <td>{r.codingScore}</td>
              <td>{r.aiScore}</td>
              <td>{r.totalScore?.toFixed(2)}</td>
              <td>{r.percentage?.toFixed(1)}%</td>
              <td>{r.attempt?.warningCount}</td>
              <td>
                <Badge>{r.attempt?.status}</Badge>
                <small>{r.status}</small>
              </td>
              <td>
                {r.attempt?.submittedAt
                  ? new Date(r.attempt.submittedAt).toLocaleString()
                  : "—"}
              </td>
              <td>
                <button onClick={() => onView(r.attempt._id)}>Details</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
