import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, ClipboardList, Radio, CalendarDays, FileEdit, ArrowUpRight, Layers3, CheckCircle2 } from "lucide-react";
import { assessmentService } from "../../services/assessmentService";
import { errorMessage } from "../../services/api";
import AssessmentCard from "../../components/teacher/AssessmentCard";
import ReuseAssessmentModal from "../../components/teacher/ReuseAssessmentModal";
import { useAssessmentUpdates } from "../../hooks/useAssessmentUpdates";

export default function Assessments() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]), [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL"), [type, setType] = useState("ALL"), [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [reuseId, setReuseId] = useState(null);
  async function load() {
    setLoading(true); setError("");
    try { setRows((await assessmentService.list()).data); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useAssessmentUpdates(useCallback(() => {
    assessmentService.list().then(({ data }) => { setRows(data); setError(""); }).catch((e) => setError(errorMessage(e)));
  }, []));
  const count = (value) => value === "ALL" ? rows.length : rows.filter((a) => a.status === value).length;
  const visible = rows.filter((a) => (status === "ALL" || a.status === status) && (type === "ALL" || a.type === type) && `${a.title} ${a.description || ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : sort === "duration" ? a.duration - b.duration : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return (
    <div className="assessment-hub">
      <header className="ah-heading">
        <div><span className="ah-kicker"><Layers3 size={14} /> YOUR ASSESSMENT WORKSPACE</span><h1>Good assessments.<br /><span>Better learning.</span></h1><p>Create a challenge, bring your students together, and follow their progress.</p></div>
        <Link className="btn ah-create" to="/teacher/assessments/new"><Plus size={18} /> Create assessment</Link>
      </header>
      <div className="ah-metrics" aria-label="Assessment overview">
        {[["ALL", "Total assessments", ClipboardList, "Everything in one place"], ["LIVE", "Live now", Radio, "Currently accepting attempts"], ["SCHEDULED", "Scheduled", CalendarDays, "Prepared for a later start"], ["DRAFT", "Drafts", FileEdit, "Ready for your next edit"], ["ENDED", "Completed", CheckCircle2, "Finished assessments"]].map(([key, label, Icon, hint]) => (
          <button type="button" className={`ah-metric metric-${key.toLowerCase()} ${status === key ? "active" : ""}`} key={key} onClick={() => setStatus(key)} aria-pressed={status === key}>
            <span className="ah-metric-top"><span>{label}</span><Icon size={18} /></span><strong>{loading ? "—" : count(key)}</strong><small>{hint}</small>
          </button>
        ))}
      </div>
      <section className="ah-library" aria-label="Assessment library">
        <div className="ah-toolbar">
          <label className="ah-search"><Search size={18} /><input aria-label="Search assessments" placeholder="Search by title or description…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <select aria-label="Filter assessment type" value={type} onChange={(e) => setType(e.target.value)}><option value="ALL">All types</option><option value="QUIZ">Quiz</option><option value="CODING">Coding</option><option value="MIXED">Mixed</option></select>
          <select aria-label="Sort assessments" value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">Newest first</option><option value="title">Title A–Z</option><option value="duration">Shortest duration</option></select>
          <Link className="ah-question-bank-link" to="/teacher/questions">Question bank <ArrowUpRight size={16} /></Link>
        </div>
        {error ? <div className="ah-empty" role="alert"><p>{error}</p><button className="btn secondary" onClick={load}>Try again</button></div> : loading ? <div className="ah-empty" role="status">Loading your assessments…</div> : visible.length ? <>
          <div className="ah-cards">{visible.map((a) => <AssessmentCard key={a._id} assessment={a} onReuse={setReuseId} onDeleted={(id) => setRows((previous) => previous.filter((item) => item._id !== id))} />)}</div>
          <p className="ah-result-count">Showing {visible.length} of {rows.length} assessments</p>
        </> : <div className="ah-empty"><span className="ah-empty-icon"><ClipboardList size={30} /></span><h3>{rows.length ? "No matching assessments" : "Your next assessment starts here"}</h3><p>{rows.length ? "Try another search or clear your filters." : "Choose saved questions and create your first assessment in a few simple steps."}</p>
          {rows.length ? <button className="btn secondary" onClick={() => { setSearch(""); setType("ALL"); setStatus("ALL"); }}>Clear filters</button> : <Link className="btn" to="/teacher/assessments/new"><Plus size={17} /> Create assessment</Link>}
        </div>}
      </section>
      {reuseId && <ReuseAssessmentModal assessmentId={reuseId} onClose={() => setReuseId(null)} onCreated={async (newId) => {
        setReuseId(null);
        try { setRows((await assessmentService.list()).data); }
        catch (e) { setError(errorMessage(e)); }
        navigate(`/teacher/assessments/${newId}`);
      }} />}
    </div>
  );
}
