import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Radio, RefreshCw } from "lucide-react";
import { api, errorMessage } from "../../services/api";
import { assessmentService } from "../../services/assessmentService";
import { useToast } from "../../components/common/Toast";
import Button from "../../components/common/Button";
import { useSocket } from "../../hooks/useSocket";
import LiveStudentCard from "../../components/teacher/LiveStudentCard";
import ViolationLog from "../../components/teacher/ViolationLog";
import Modal from "../../components/common/Modal";
import AssessmentPicker from "../../components/teacher/AssessmentPicker";
import { cacheAssessmentCode, readCachedAssessmentCode } from "../../utils/assessmentAccessCode";
export default function LiveMonitor() {
  const [assessments, A] = useState([]),
    [id, I] = useState(""),
    [rows, R] = useState([]),
    [events, E] = useState(null),
    [restartTarget, setRestartTarget] = useState(null),
    [pendingTimeChange, setPendingTimeChange] = useState(null),
    [accessCode, setAccessCode] = useState(""),
    [accessCodeCopied, setAccessCodeCopied] = useState(false),
    [minutes, setMinutes] = useState(10),
    [selectedStudents, setSelectedStudents] = useState(() => new Set()),
    [monitorNow, setMonitorNow] = useState(Date.now()),
    [refreshing, setRefreshing] = useState(false),
    [busy, setBusy] = useState(false);
  const selectedAssessment = assessments.find((assessment) => assessment._id === id);
  const isLive = selectedAssessment?.status === "LIVE";
  const restartAssessmentDeadline = selectedAssessment ? [
    selectedAssessment.closesAt,
    selectedAssessment.endTime,
    selectedAssessment.startedAt && selectedAssessment.duration > 0
      ? new Date(new Date(selectedAssessment.startedAt).getTime() + selectedAssessment.duration * 60000)
      : null,
  ].filter(Boolean).map((date) => new Date(date).getTime()).reduce((min, date) => Math.min(min, date), Infinity) : Infinity;
  const restartReopensAssessment = selectedAssessment?.status === "ENDED" && restartAssessmentDeadline > monitorNow;
  const restartUnavailable = !Number.isFinite(restartAssessmentDeadline) || restartAssessmentDeadline <= monitorNow;
  const restartTimeMs = restartUnavailable ? 0 : restartAssessmentDeadline - monitorNow;
  const sharedTimeRemaining = Number.isFinite(restartAssessmentDeadline)
    ? `${Math.max(0, Math.ceil((restartAssessmentDeadline - monitorNow) / 60000))} min`
    : "—";
  const restartMinutes = Math.ceil(restartTimeMs / 60000);
  const restartTimeLabel = restartMinutes >= 60
    ? `${Math.floor(restartMinutes / 60)} hr${Math.floor(restartMinutes / 60) === 1 ? "" : "s"}${restartMinutes % 60 ? ` ${restartMinutes % 60} min` : ""}`
    : `${restartMinutes} min`;
  const toast = useToast();
  const load = useCallback(() => {
    if (id)
      return Promise.all([api.get("/assessments/" + id + "/monitor"), api.get("/assessments")])
        .then(([r, list]) => { R(r.data); A(list.data); })
        .catch((e) => toast(errorMessage(e)));
    return api.get("/assessments")
      .then(({ data }) => {
        A(data);
        const live = data
          .filter((assessment) => assessment.status === "LIVE")
          .sort((left, right) => new Date(right.startedAt || right.updatedAt || 0) - new Date(left.startedAt || left.updatedAt || 0));
        if (live.length) I(live[0]._id);
      })
      .catch((e) => toast(errorMessage(e)));
  }, [id]);
  const connected = useSocket(useCallback(() => load(), [load]));
  async function refreshMonitor() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    if (!id) {
      R([]);
      load();
      const t = setInterval(load, 10000);
      return () => clearInterval(t);
    }
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => setSelectedStudents(new Set()), [id]);
  useEffect(() => {
    let active = true;
    setAccessCode(readCachedAssessmentCode(id));
    setAccessCodeCopied(false);
    if (!id) return () => { active = false; };
    api.get(`/assessments/${id}/access-code`)
      .then(({ data }) => {
        if (!active || !data.accessCode) return;
        setAccessCode(data.accessCode);
        cacheAssessmentCode(id, data.accessCode);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    const interval = setInterval(() => setMonitorNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);
  function selectStudent(studentId, checked) {
    setSelectedStudents((current) => {
      const next = new Set(current);
      if (checked) next.add(studentId); else next.delete(studentId);
      return next;
    });
  }
  async function copyAccessCode() {
    try {
      await navigator.clipboard.writeText(accessCode);
      setAccessCodeCopied(true);
    } catch {
      toast("Copy isn’t available. Select the code and copy it manually.");
    }
  }
  function requestTimeExtension(scope, studentIds = []) {
    const amount = Number(minutes);
    if (!id || !Number.isInteger(amount) || amount < 1 || amount > 480) return;
    setPendingTimeChange({ scope, studentIds, minutes: amount });
  }
  async function confirmTimeExtension() {
    if (!id || !pendingTimeChange || busy) return;
    const { scope, studentIds, minutes: amount } = pendingTimeChange;
    setBusy(true);
    try {
      const { data } = await assessmentService.extendMonitorTime(id, {
        minutes: amount, scope, studentIds,
      });
      toast(`Added ${amount} minutes${scope === "ASSESSMENT" ? " to the assessment" : ` to ${data.updatedAttempts} student${data.updatedAttempts === 1 ? "" : "s"}`}.`, { success: true });
      if (scope === "STUDENTS") setSelectedStudents(new Set());
      setPendingTimeChange(null);
      await load();
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function restartAttempt(mode) {
    if (!restartTarget) return;
    setBusy(true);
    try {
      await assessmentService.restartStudentAttempt(id, restartTarget.student._id, mode);
      toast(`${restartTarget.student.name}'s attempt was restarted.`, { success: true });
      setRestartTarget(null);
      await load();
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function showHistory(row) {
    if (!row.attempt) return;
    try {
      E({
        name: row.student.name,
        data: (await api.get(`/assessments/attempt/${row.attempt._id}/events`)).data,
      });
    } catch (e) {
      toast(errorMessage(e));
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">REAL-TIME OVERSIGHT</span>
          <h1>Live monitor</h1>
          <p>Observable events are signals, not proof of misconduct.</p>
        </div>
        <div className="row gap">
          <Button variant="secondary" disabled={refreshing} onClick={refreshMonitor}>
            <RefreshCw size={16} className={`monitor-refresh-icon${refreshing ? " spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <span className="pill">
            <span className="dot" />
            {connected ? "Connected" : "Reconnecting…"}
          </span>
        </div>
      </div>
      <div className="monitor-assessment-picker">
        <AssessmentPicker assessments={assessments} value={id} onChange={I} ariaLabel="Select assessment to monitor" placeholder="Choose an assessment…" />
      </div>
      {!selectedAssessment ? (
        <div className="submission-empty-state monitor-empty-state">
          <span><Radio size={24} /></span>
          <h2>Select an assessment</h2>
          <p>Choose an assessment above to see student status, submissions, warnings and live monitoring controls.</p>
        </div>
      ) : <>
      {selectedAssessment.status === "ENDED" && <p className="notice" role="status">This assessment has ended. Restarting a student will reopen it for that student only.</p>}
      <section className="monitor-access-code" aria-label="Assessment access code">
        <span className="monitor-access-code-icon"><KeyRound size={18} /></span>
        <div className="monitor-access-code-copy"><small>STUDENT ACCESS CODE</small><strong>{accessCode || "Not available"}</strong></div>
        <p>{accessCode ? "Share this code with students who need to join or restart." : "Generate a code from the assessment page. Previously generated codes will appear here once saved."}</p>
        {accessCode && <Button type="button" variant="secondary" onClick={copyAccessCode}>{accessCodeCopied ? <Check size={15} /> : <Copy size={15} />}{accessCodeCopied ? "Copied" : "Copy code"}</Button>}
      </section>
      <section className="monitor-time-controls" aria-label="Assessment time controls">
        <div>
          <h2>Adjust assessment time</h2>
          <p>
            Assessment total: {selectedAssessment?.duration ?? "—"} min · Shared time left: {sharedTimeRemaining}.
            Individual extensions change only selected students’ clocks.
          </p>
        </div>
        <label>Minutes to add
          <input type="number" min="1" max="480" step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
        </label>
        <Button disabled={!isLive || busy || !Number.isInteger(Number(minutes)) || Number(minutes) < 1}
          onClick={() => requestTimeExtension("ASSESSMENT")}>Add to assessment</Button>
        <Button variant="secondary" disabled={!isLive || busy || !selectedStudents.size || !Number.isInteger(Number(minutes)) || Number(minutes) < 1}
          onClick={() => requestTimeExtension("STUDENTS", [...selectedStudents])}>Add to selected ({selectedStudents.size})</Button>
      </section>
      {!isLive && selectedAssessment && <p className="monitor-time-note">Time can be extended while an assessment is live. Individual attempts can still be restarted after submission or termination.</p>}
      <div className="live-monitor-list" aria-label="Students in this assessment">
        <div className="live-monitor-list-heading" aria-hidden="true">
          <span></span><span>Student</span><span>Status</span><span>Warnings</span><span>Time left</span><span>Last event</span><span>Actions</span>
        </div>
        {rows.map((row) => (
          <LiveStudentCard
            row={row}
            key={row.student._id}
            onHistory={showHistory}
            onRestart={(row) => { setMonitorNow(Date.now()); setRestartTarget(row); }}
            selected={selectedStudents.has(row.student._id)}
            onSelect={selectStudent}
            timeDisabled={!isLive || busy}
            restartDisabled={busy || restartUnavailable}
          />
        ))}
      </div>
      {!rows.length && (
        <div className="card empty">
          No assigned students in this assessment yet.
        </div>
      )}
      </>}
      {events && (
        <Modal title={events.name + " · Event history"} onClose={() => E(null)}>
          <ViolationLog events={events.data} />
        </Modal>
      )}
      {pendingTimeChange && (
        <Modal title="Confirm time extension" onClose={() => !busy && setPendingTimeChange(null)} className="restart-attempt-modal">
          <p>
            {pendingTimeChange.scope === "ASSESSMENT"
              ? `Are you sure you want to add ${pendingTimeChange.minutes} minutes to this assessment and its active attempts?`
              : `Are you sure you want to add ${pendingTimeChange.minutes} minutes to the active attempts of ${pendingTimeChange.studentIds.length} selected student${pendingTimeChange.studentIds.length === 1 ? "" : "s"}?`}
          </p>
          <div className="restart-attempt-options">
            <Button variant="secondary" disabled={busy} onClick={() => setPendingTimeChange(null)}>Cancel</Button>
            <Button disabled={busy} onClick={confirmTimeExtension}>{busy ? "Adding time…" : "Confirm and add time"}</Button>
          </div>
        </Modal>
      )}
      {restartTarget && (
        <Modal title={`Restart ${restartTarget.student.name}'s attempt`} onClose={() => !busy && setRestartTarget(null)} className="restart-attempt-modal">
          <p>
            {restartUnavailable
              ? "The assessment deadline has passed, so no time remains for a restart."
              : `Choose how the student should return. ${restartReopensAssessment
                ? `The assessment will reopen for this student with ${restartTimeLabel} remaining on its original clock.`
                : `They will have ${restartTimeLabel} remaining, until the assessment ends.`}`}
          </p>
          <div className="restart-attempt-options">
            <Button variant="secondary" disabled={busy || restartUnavailable} onClick={() => restartAttempt("CONTINUE")}>Continue where they left off</Button>
            <Button disabled={busy || restartUnavailable} onClick={() => restartAttempt("BEGINNING")}>Start from the beginning</Button>
          </div>
          <small>Continue keeps their saved answers and question position. Starting over clears answers and the previous score.</small>
        </Modal>
      )}
    </>
  );
}
