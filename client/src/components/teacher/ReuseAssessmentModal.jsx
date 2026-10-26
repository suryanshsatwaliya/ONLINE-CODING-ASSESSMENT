import { useEffect, useState } from "react";
import { api, errorMessage } from "../../services/api";
import Button from "../common/Button";
import Input from "../common/Input";
import Modal from "../common/Modal";
import { useToast } from "../common/Toast";
import SecuritySettings, { defaultSecurity } from "./SecuritySettings";

export default function ReuseAssessmentModal({ assessmentId, onClose, onCreated }) {
  const toast = useToast();
  const [source, setSource] = useState(null);
  const [students, setStudents] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [duration, setDuration] = useState(60);
  const [status, setStatus] = useState("DRAFT");
  const [startTime, setStartTime] = useState("");
  const [securitySettings, setSecuritySettings] = useState(defaultSecurity);
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.get(`/assessments/${assessmentId}`), api.get("/students")])
      .then(([assessment, roster]) => {
        if (!active) return;
        setSource(assessment.data);
        setTitle(`${assessment.data.title.replace(/(?: \(Copy\))+$/i, "")} (Copy)`);
        setDescription(assessment.data.description || "");
        setInstructions(assessment.data.instructions || "");
        setDuration(assessment.data.duration);
        setSecuritySettings({
          ...defaultSecurity,
          ...(assessment.data.securitySettings || {}),
          eventRules: { ...defaultSecurity.eventRules, ...(assessment.data.securitySettings?.eventRules || {}) },
        });
        setStudents(roster.data);
      })
      .catch((e) => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [assessmentId]);

  const sections = [...new Set(students.map((student) => student.section).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const visibleStudents = students.filter((student) =>
    (!section || student.section === section) &&
    `${student.name} ${student.uid} ${student.course} ${student.section}`.toLowerCase().includes(search.toLowerCase()),
  ).sort((a, b) => a.uid.localeCompare(b.uid, undefined, { numeric: true, sensitivity: "base" }));

  function assessmentPayload() {
    return {
      title: title.trim(),
      description,
      instructions,
      type: source.type,
      duration: Number(duration),
      status,
      startTime: status === "SCHEDULED" && startTime ? new Date(startTime).toISOString() : null,
      endTime: null,
      questionIds: (source.questions || []).filter((question) => !question.sourceSetId).map((question) => String(question._id)),
      questionSetIds: (source.questionSets || []).map((set) => String(set.setId)),
      securitySettings,
      randomizeQuestions: Boolean(source.randomizeQuestions),
      randomizeOptions: Boolean(source.randomizeOptions),
      publishResults: false,
      aiEnabled: Boolean(source.aiEnabled),
      aiRubric: source.aiRubric || "Assess code quality, readability and algorithmic efficiency.",
      maxCodeRuns: source.maxCodeRuns || 0,
    };
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    if (!selected.length) {
      setError("Select at least one student for the reused assessment.");
      return;
    }
    setSaving(true);
    try {
      let newId = createdId;
      if (!newId) {
        const { data } = await api.post(`/assessments/${assessmentId}/reuse`, assessmentPayload());
        newId = data._id;
        setCreatedId(newId);
      } else {
        await api.put(`/assessments/${newId}`, assessmentPayload());
      }
      await api.post(`/assessments/${newId}/assign`, { studentIds: selected });
      toast("Assessment saved successfully", { success: true });
      await onCreated(newId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal className="reuse-assessment-modal" title="Reuse completed assessment" onClose={saving ? undefined : onClose}>
      {loading ? <p role="status">Loading assessment and students…</p> : error && !source ? (
        <div className="notice error" role="alert">{error}</div>
      ) : source && (
        <form className="reuse-assessment-form" onSubmit={save}>
          <p className="reuse-assessment-help">The questions and assessment rules will be copied. Choose a new title, duration and students for this run.</p>
          <div className="form-grid">
            <Input label="New assessment name" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input label="Duration (minutes)" type="number" required min={1} max={480} value={duration} onChange={(e) => setDuration(e.target.value === "" ? "" : Number(e.target.value))} />
            <label className="field">Save as<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="DRAFT">Draft · prepare for later</option><option value="SCHEDULED">Scheduled · start later</option></select></label>
            {status === "SCHEDULED" && <Input label="Scheduled start time (optional)" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
          </div>
          <label className="field">Description<textarea rows={2} maxLength={20000} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <details className="as-disclosure"><summary>Student instructions</summary><label className="field"><textarea rows={3} maxLength={20000} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></label></details>
          <details className="as-disclosure"><summary>Review and customize security</summary><SecuritySettings value={securitySettings} onChange={setSecuritySettings} /></details>
          <div className="reuse-section-tools">
            <label className="field">Filter by section<select value={section} onChange={(e) => setSection(e.target.value)}><option value="">All sections</option>{sections.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="field">Search students<input placeholder="Name, UID or course…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          </div>
          <div className="row wrap reuse-student-actions">
            <Button type="button" variant="secondary" disabled={!visibleStudents.length} onClick={() => setSelected((previous) => [...new Set([...previous, ...visibleStudents.map((student) => student._id)])])}>Select all shown ({visibleStudents.length})</Button>
            {selected.length > 0 && <Button type="button" variant="secondary" onClick={() => setSelected([])}>Clear selection</Button>}
            <span>{selected.length} students selected</span>
          </div>
          <div className="as-student-list reuse-student-list">
            {visibleStudents.map((student) => <label key={student._id}><input type="checkbox" checked={selected.includes(student._id)} onChange={(e) => setSelected((previous) => e.target.checked ? [...previous, student._id] : previous.filter((id) => id !== student._id))} /><span><strong>{student.name}</strong><small>{student.uid} · {student.course} · {student.section}</small></span></label>)}
            {!students.length && <p>No students are available.</p>}
            {students.length > 0 && !visibleStudents.length && <p>No students match this section or search.</p>}
          </div>
          {error && <p className="notice error" role="alert">{error}</p>}
          <div className="row wrap between">
            <span className="reuse-assessment-help">{status === "SCHEDULED" ? startTime ? "This assessment will be available at its scheduled start time." : "You can start this assessment manually when ready." : "This will create a new draft assessment."}</span>
            <div className="row"><Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || !title.trim() || !duration}>{saving ? "Saving…" : createdId ? "Save and retry assignment" : status === "SCHEDULED" ? "Schedule assessment" : "Create draft"}</Button></div>
          </div>
        </form>
      )}
    </Modal>
  );
}
