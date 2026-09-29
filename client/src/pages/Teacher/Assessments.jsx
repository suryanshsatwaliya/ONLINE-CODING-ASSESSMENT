import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { assessmentService } from "../../services/assessmentService";
import { errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import AssessmentCard from "../../components/teacher/AssessmentCard";
export default function Assessments() {
  const [rows, R] = useState([]),
    [search, S] = useState("");
  const toast = useToast();
  useEffect(() => {
    assessmentService
      .list()
      .then((r) => R(r.data))
      .catch((e) => toast(errorMessage(e)));
  }, []);
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">ASSESSMENT STUDIO</span>
          <h1>Assessments</h1>
          <p>Build, schedule and launch your next challenge.</p>
        </div>
        <Link className="btn" to="/teacher/assessments/new">
          + Create assessment
        </Link>
      </div>
      <input
        className="search"
        placeholder="Search assessments…"
        value={search}
        onChange={(e) => S(e.target.value)}
      />
      <div className="grid two">
        {rows
          .filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
          .map((a) => (
            <AssessmentCard key={a._id} assessment={a} />
          ))}
      </div>
      {!rows.length && (
        <div className="empty card">
          Your assessment studio is ready. Create your first assessment.
        </div>
      )}
    </>
  );
}
