import Badge from "../common/Badge";
export default function StudentTable({ students, onEdit, onDelete }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>UID</th>
            <th>Course / Section</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s._id}>
              <td>
                <strong>{s.name}</strong>
                <small>{s.email}</small>
              </td>
              <td>{s.uid}</td>
              <td>
                {s.course}
                <small>{s.section}</small>
              </td>
              <td>
                <Badge>{s.status}</Badge>
              </td>
              <td>
                <button onClick={() => onEdit(s)}>Edit</button>{" "}
                <button className="danger-text" onClick={() => onDelete(s)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!students.length && (
        <div className="empty">
          No matching students. Add your first student to get started.
        </div>
      )}
    </div>
  );
}
