import { Link } from "react-router-dom";
import DeleteAssessmentButton from "./DeleteAssessmentButton";
import { ArrowUpRight, ClipboardList, Code2, Layers3, Clock3, Award, CalendarDays } from "lucide-react";
const labels = { DRAFT: "Draft", LIVE: "Live now", SCHEDULED: "Scheduled", ENDED: "Completed" };
export default function AssessmentCard({ assessment: a, onDeleted }) {
  const Icon = a.type === "CODING" ? Code2 : a.type === "MIXED" ? Layers3 : ClipboardList;
  const date = a.startTime ? new Date(a.startTime) : null;
  return (
    <article className="ah-assessment-card">
      <Link to={"/teacher/assessments/" + a._id} className="ah-card-main">
      <div className="ah-card-top"><span className={`ah-type-icon type-${a.type.toLowerCase()}`}><Icon size={23} /></span><span className={`ah-status status-${a.status.toLowerCase()}`}><i />{labels[a.status] || a.status}</span></div>
      <span className="ah-card-type">{a.type === "MIXED" ? "QUIZ + CODING" : a.type === "CODING" ? "CODING ASSESSMENT" : "QUIZ ASSESSMENT"}</span>
      <h3>{a.title}</h3><p className="ah-card-description">{a.description || "A focused challenge for your students. Open to review the details."}</p>
      <div className="ah-card-meta"><span><Clock3 size={15} />{a.duration} min</span><span><Award size={15} />{a.totalMarks || 0} points</span></div>
      </Link>
      <div className="ah-card-footer"><span>{date && !Number.isNaN(date.getTime()) ? <><CalendarDays size={14} />{date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</> : a.status === "DRAFT" ? "Not published yet" : "Teacher-managed start"}</span><div className="ah-card-actions">{onDeleted && <DeleteAssessmentButton assessment={a} onDeleted={onDeleted} />}<Link to={"/teacher/assessments/" + a._id}><strong>{a.status === "DRAFT" ? "Continue setup" : "Manage"}<ArrowUpRight size={17} /></strong></Link></div></div>
    </article>
  );
}
