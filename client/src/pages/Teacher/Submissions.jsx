import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, FileCheck2, Clock3, Users, ChartNoAxesCombined, CheckCircle2, Code2 } from "lucide-react";
import { api, errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import AssessmentPicker from "../../components/teacher/AssessmentPicker";

function attemptStatus(attempt) {
  if (!attempt) return "Not started";
  if (attempt.status === "ACTIVE") return attempt.connected ? "In progress" : "Disconnected";
  if (attempt.status === "SUBMITTED") return "Submitted";
  if (attempt.status === "TERMINATED") return "Terminated";
  if (attempt.status === "EXPIRED") return "Expired";
  return attempt.status;
}

function formatMarks(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function Submissions() {
  const [assessments, setAssessments] = useState([]);
  const [id, setId] = useState("");
  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);
  const [codeSubmissions, setCodeSubmissions] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [assessmentInfo, setAssessmentInfo] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailTab, setDetailTab] = useState("QUIZ");
  const [aiDrafts, setAiDrafts] = useState({});
  const toast = useToast();

  const selectedAssessment = assessmentInfo?._id === id
    ? assessmentInfo
    : assessments.find((assessment) => assessment._id === id);
  const questions = selectedAssessment?.questions || [];
  const quizQuestions = questions.filter((question) => question.type !== "CODING");
  const codingQuestions = questions.filter((question) => question.type === "CODING");
  const showQuizMarks = quizQuestions.length > 0;
  const showCodingMarks = codingQuestions.length > 0;
  const showAiMarks = showCodingMarks && Boolean(selectedAssessment?.aiEnabled);
  const showCombinedTotal = [showQuizMarks, showCodingMarks, showAiMarks].filter(Boolean).length > 1;
  const quizMax = quizQuestions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
  const codingMax = codingQuestions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
  const aiMax = selectedAssessment?.aiEnabled
    ? codingQuestions.reduce((sum, question) => sum + Number(question.qualityMarks || 0) + Number(question.efficiencyMarks || 0), 0)
    : 0;
  const totalMax = Number(selectedAssessment?.totalMarks || quizMax + codingMax + aiMax);
  const resultsByAttempt = useMemo(() => new Map(results.map((result) => [String(result.attempt?._id), result])), [results]);
  const jobsByAttempt = useMemo(() => {
    const map = new Map();
    for (const submission of codeSubmissions) {
      const attemptId = String(submission.attempt);
      if (!map.has(attemptId)) map.set(attemptId, []);
      map.get(attemptId).push(submission);
    }
    return map;
  }, [codeSubmissions]);

  async function loadAssessment(assessmentId = id) {
    if (!assessmentId) return;
    setLoading(true);
    try {
      const [assessmentResponse, monitorResponse, resultsResponse, jobsResponse] = await Promise.all([
        api.get(`/assessments/${assessmentId}`),
        api.get(`/assessments/${assessmentId}/monitor`),
        api.get(`/results/${assessmentId}`),
        api.get(`/results/submissions?assessmentId=${assessmentId}`),
      ]);
      setAssessmentInfo(assessmentResponse.data);
      setStudents(monitorResponse.data);
      setResults(resultsResponse.data);
      setCodeSubmissions(jobsResponse.data);
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) {
      let active = true;
      const refreshAssessmentChoices = () => api.get("/assessments")
        .then(({ data }) => {
          if (!active) return;
          setAssessments(data);
          const live = data
            .filter((assessment) => assessment.status === "LIVE")
            .sort((left, right) => new Date(right.startedAt || right.updatedAt || 0) - new Date(left.startedAt || left.updatedAt || 0));
          if (live.length) setId(live[0]._id);
        })
        .catch((error) => { if (active) toast(errorMessage(error)); });
      refreshAssessmentChoices();
      const interval = setInterval(refreshAssessmentChoices, 10000);
      return () => { active = false; clearInterval(interval); };
    }
    return undefined;
  }, [id]);

  useEffect(() => {
    setStudents([]);
    setResults([]);
    setCodeSubmissions([]);
    setAssessmentInfo(null);
    setSearch("");
    setStatusFilter("ALL");
    if (id) loadAssessment(id);
  }, [id]);

  async function retryCodeJob(submission) {
    try {
      await api.post(`/results/retry/${submission._id}`);
      toast("Code submission queued for retry.", { success: true });
      await loadAssessment();
      await refreshDetail();
    } catch (error) {
      toast(errorMessage(error));
    }
  }

  async function loadAttemptDetails(attemptId) {
    try {
      const data = (await api.get(`/results/attempt/${attemptId}`)).data;
      setDetail(data);
      setDetailTab(data.assessment.questions.some((question) => question.type !== "CODING") ? "QUIZ" : "CODING");
      setAiDrafts(Object.fromEntries((data.reviews || []).map((review) => [review._id, {
        qualityScore: review.qualityScore,
        efficiencyScore: review.efficiencyScore,
      }])));
    } catch (error) {
      toast(errorMessage(error));
    }
  }

  async function refreshDetail() {
    if (detail?.attempt?._id) {
      const data = (await api.get(`/results/attempt/${detail.attempt._id}`)).data;
      setDetail(data);
      setAiDrafts(Object.fromEntries((data.reviews || []).map((review) => [review._id, {
        qualityScore: review.qualityScore,
        efficiencyScore: review.efficiencyScore,
      }])));
    }
  }

  async function requestAiReview(submission) {
    try {
      await api.post(`/ai/${submission._id}`);
      toast("AI review requested.", { success: true });
      await refreshDetail();
    } catch (error) {
      toast(errorMessage(error));
    }
  }

  async function saveAiReview(review, status) {
    const draft = aiDrafts[review._id] || review;
    try {
      await api.patch(`/ai/${review._id}`, {
        qualityScore: Number(draft.qualityScore || 0),
        efficiencyScore: Number(draft.efficiencyScore || 0),
        status,
      });
      toast("AI review saved.", { success: true });
      await refreshDetail();
      await loadAssessment();
    } catch (error) {
      toast(errorMessage(error));
    }
  }

  const filteredStudents = useMemo(() => students
    .map((row) => {
      const attemptId = String(row.attempt?._id || "");
      const result = resultsByAttempt.get(attemptId);
      const jobs = jobsByAttempt.get(attemptId) || [];
      return { ...row, result, jobs, latestJob: jobs[0] };
    })
    .filter((row) => {
      const matchesSearch = `${row.student?.name || ""} ${row.student?.uid || ""}`.toLowerCase().includes(search.toLowerCase());
      const currentStatus = row.attempt?.status || "NOT_STARTED";
      return matchesSearch && (statusFilter === "ALL" || currentStatus === statusFilter);
    })
    .sort((left, right) => (left.student?.uid || "").localeCompare(right.student?.uid || "", undefined, { numeric: true, sensitivity: "base" })),
  [students, resultsByAttempt, jobsByAttempt, search, statusFilter]);

  const submittedCount = students.filter((row) => row.attempt?.status === "SUBMITTED").length;
  const gradedResults = results.filter((result) => result.status === "GRADED");
  const average = gradedResults.length
    ? (gradedResults.reduce((sum, result) => sum + Number(result.totalScore || 0), 0) / gradedResults.length).toFixed(1)
    : "—";
  const pendingJobs = codeSubmissions.filter((submission) => ["QUEUED", "RUNNING"].includes(submission.status)).length;

  return (
    <>
      <header className="submission-review-heading">
        <div>
          <span className="eyebrow">ASSESSMENT REVIEW</span>
          <h1>Submissions &amp; results</h1>
          <p>Choose an assessment to review every student’s progress, marks and coding submissions in one place.</p>
        </div>
        <Button variant="secondary" disabled={!id || loading} onClick={() => loadAssessment()}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </header>

      <section className="submission-assessment-picker" aria-label="Choose assessment to review">
        <div className="submission-picker-copy">
          <span className="submission-picker-icon"><FileCheck2 size={19} /></span>
          <div>
            <strong>Assessment</strong>
            <small>Select one to load its student submissions and results</small>
          </div>
        </div>
        <AssessmentPicker assessments={assessments} value={id} onChange={setId} ariaLabel="Select assessment to review" />
      </section>

      {!id ? (
        <div className="submission-empty-state">
          <span><FileCheck2 size={24} /></span>
          <h2>Select an assessment</h2>
          <p>Student statuses, marks, warnings and coding submissions will appear here.</p>
        </div>
      ) : (
        <>
          <div className="submission-assessment-summary">
            <div><span>Selected assessment</span><strong>{selectedAssessment?.title || "Assessment"}</strong></div>
            <Badge>{selectedAssessment?.status === "ENDED" ? "Completed" : selectedAssessment?.status || "—"}</Badge>
          </div>

          <section className={`submission-metrics${showCodingMarks ? " has-coding" : " no-coding"}`} aria-label="Assessment summary">
            <article><span className="submission-metric-icon"><Users size={17} /></span><div><small>Students</small><strong>{students.length}</strong></div></article>
            <article><span className="submission-metric-icon is-green"><FileCheck2 size={17} /></span><div><small>Submitted</small><strong>{submittedCount} <em>of {students.length}</em></strong></div></article>
            <article><span className="submission-metric-icon"><ChartNoAxesCombined size={17} /></span><div><small>Average marks</small><strong>{average}</strong></div></article>
            {showCodingMarks && <article><span className="submission-metric-icon is-amber"><Clock3 size={17} /></span><div><small>Code jobs pending</small><strong>{pendingJobs}</strong></div></article>}
          </section>

          <section className="submission-results-panel">
            <div className="submission-results-toolbar">
              <div>
                <h2>Student results</h2>
                <p>One row per assigned student, including attempts still in progress.</p>
              </div>
              <div className="submission-filters">
                <label className="submission-search"><Search size={16} /><input aria-label="Search students" placeholder="Search name or UID" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                <select aria-label="Filter by submission status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="ALL">All statuses</option>
                  <option value="NOT_STARTED">Not started</option>
                  <option value="ACTIVE">In progress</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="TERMINATED">Terminated</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
            </div>

            <div className="submission-results-table-wrap">
              <table className="submission-results-table">
                <thead><tr>
                  <th>Student</th><th>Submission</th>
                  {showQuizMarks && <th>Quiz marks</th>}
                  {showCodingMarks && <th>Coding marks</th>}
                  {showAiMarks && <th>AI marks</th>}
                  {showCombinedTotal && <th>Total</th>}<th>Total marks</th><th>Warnings</th>
                  {showCodingMarks && <th>Code jobs</th>}
                  <th>Submitted</th><th>Details</th>
                </tr></thead>
                <tbody>
                  {filteredStudents.map((row) => {
                    const attempt = row.attempt;
                    const result = row.result;
                    const job = row.latestJob;
                    const statusLabel = attemptStatus(attempt);
                    const submittedDate = attempt?.submittedAt ? new Date(attempt.submittedAt) : null;
                    return (
                      <tr key={row.student._id}>
                        <td><strong>{row.student.name}</strong><small>{row.student.uid || "UID unavailable"}</small></td>
                        <td><Badge>{statusLabel}</Badge>{result && <small>{result.status}</small>}</td>
                        {showQuizMarks && <td>{result ? formatMarks(result.quizScore) : "—"}</td>}
                        {showCodingMarks && <td>{result ? formatMarks(result.codingScore) : "—"}</td>}
                        {showAiMarks && <td>{result ? formatMarks(result.aiScore) : "—"}</td>}
                        {showCombinedTotal && <td><strong>{result ? formatMarks(result.totalScore) : "—"}</strong></td>}
                        <td>{formatMarks(totalMax)}</td>
                        <td>{attempt ? `${attempt.warningCount || 0} / ${row.maxWarnings}` : "—"}</td>
                        {showCodingMarks && <td>{row.jobs.length ? <><Badge>{job.status}</Badge><small>{row.jobs.length} run{row.jobs.length === 1 ? "" : "s"}</small></> : "—"}</td>}
                        <td>{submittedDate ? <span className="submission-datetime"><time dateTime={submittedDate.toISOString()}>{submittedDate.toLocaleDateString()}</time><time dateTime={submittedDate.toISOString()}>{submittedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></span> : "—"}</td>
                        <td className="submission-row-actions">
                          {attempt && <Button variant="secondary" onClick={() => loadAttemptDetails(attempt._id)}>Details</Button>}
                          {job?.status === "ERROR" && <Button onClick={() => retryCodeJob(job)}>Retry</Button>}
                          {!attempt && !job && <span className="submission-no-actions">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredStudents.length && <div className="empty">{loading ? "Loading assessment data…" : students.length ? "No students match these filters." : "No students are assigned to this assessment."}</div>}
            </div>
          </section>
        </>
      )}

      {detail && (
        <Modal title={`${detail.attempt.student.name} · Submission details`} onClose={() => setDetail(null)}>
          {detail.assessment.questions.some((question) => question.type !== "CODING") && detail.assessment.questions.some((question) => question.type === "CODING") && (
            <div className="submission-detail-tabs" role="tablist" aria-label="Submission details type">
              <button type="button" role="tab" aria-selected={detailTab === "QUIZ"} className={detailTab === "QUIZ" ? "active" : ""} onClick={() => setDetailTab("QUIZ")}>Quiz answers</button>
              <button type="button" role="tab" aria-selected={detailTab === "CODING"} className={detailTab === "CODING" ? "active" : ""} onClick={() => setDetailTab("CODING")}><Code2 size={15} /> Coding work</button>
            </div>
          )}

          {(detailTab === "QUIZ" || !detail.assessment.questions.some((question) => question.type === "CODING")) && detail.assessment.questions.filter((question) => question.type !== "CODING").map((question, index) => {
            const value = detail.attempt.answers?.[question._id]?.value;
            const selected = Array.isArray(value) ? value : [];
            const correct = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
            return (
              <article className="submission-question-detail" key={question._id}>
                <div className="submission-question-kicker"><span>QUESTION {index + 1}</span><span>{formatMarks(question.marks)} marks</span></div>
                <h3>{question.title}</h3>
                <p className="submission-question-prompt">{question.question}</p>
                {question.type === "SHORT" ? (
                  <div className="submission-written-answer"><small>Student answer</small><p>{value || "No answer provided"}</p><small>Expected answer</small><p>{question.correctAnswer || "—"}</p></div>
                ) : (
                  <div className="submission-answer-options">
                    {(question.options || []).map((option, optionIndex) => {
                      const isSelected = selected.includes(optionIndex);
                      const isCorrect = correct.includes(optionIndex);
                      return <div className={`submission-answer-option${isSelected ? " is-selected" : ""}${isCorrect ? " is-correct" : ""}`} key={optionIndex}><span>{String.fromCharCode(65 + optionIndex)}</span><p>{option}</p><small>{isSelected ? "Student answer" : isCorrect ? "Correct answer" : ""}</small></div>;
                    })}
                  </div>
                )}
                {question.explanation && <p className="submission-question-prompt"><strong>Explanation:</strong> {question.explanation}</p>}
              </article>
            );
          })}

          {(detailTab === "CODING" || !detail.assessment.questions.some((question) => question.type !== "CODING")) && detail.assessment.questions.filter((question) => question.type === "CODING").map((question, index) => {
            const questionSubmissions = (detail.submissions || [])
              .filter((submission) => String(submission.questionId) === String(question._id))
              .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
            const savedCode = detail.attempt.answers?.[question._id]?.value;
            return (
              <article className="submission-question-detail" key={question._id}>
                <div className="submission-question-kicker"><span>CODING QUESTION {index + 1}</span><span>{formatMarks(question.marks)} marks</span></div>
                <h3>{question.title}</h3>
                <p className="submission-question-prompt preserve">{question.description || question.question}</p>
                {(question.constraints || question.inputFormat || question.outputFormat || question.examples?.length > 0) && <div className="submission-code-prompt-details">
                  {question.constraints && <div><strong>Constraints</strong><p className="preserve">{question.constraints}</p></div>}
                  {question.inputFormat && <div><strong>Input format</strong><p className="preserve">{question.inputFormat}</p></div>}
                  {question.outputFormat && <div><strong>Output format</strong><p className="preserve">{question.outputFormat}</p></div>}
                  {question.examples?.map((example, exampleIndex) => <div key={exampleIndex}><strong>Example {exampleIndex + 1}</strong><pre>Input: {example.input}{"\n"}Output: {example.output}{example.explanation ? `\nExplanation: ${example.explanation}` : ""}</pre></div>)}
                </div>}
                {savedCode?.code && (!questionSubmissions.length || savedCode.code !== questionSubmissions[0].code || savedCode.language !== questionSubmissions[0].language) && <div className="submission-code-version"><div className="row between"><strong>Latest saved code</strong><span>{savedCode.language}</span></div><pre>{savedCode.code}</pre></div>}
                {!questionSubmissions.length && !savedCode?.code && <p className="muted">No code was saved for this question.</p>}
                {questionSubmissions.map((submission, versionIndex) => {
                  const execution = (detail.executions || []).find((record) => String(record.submission?._id || record.submission) === String(submission._id));
                  const aiReview = (detail.reviews || []).find((record) => String(record.submission?._id || record.submission) === String(submission._id));
                  const passed = execution?.results?.filter((test) => test.passed).length || 0;
                  return (
                    <div className="submission-code-version" key={submission._id}>
                      <div className="submission-code-version-heading"><div><strong>{versionIndex === 0 ? "Latest submission" : `Previous submission ${versionIndex}`}</strong><small>{submission.language} · {new Date(submission.createdAt).toLocaleString()}</small></div><Badge>{submission.status}</Badge></div>
                      <pre>{submission.code}</pre>
                      {submission.error && <p className="error">{submission.error}</p>}
                      {execution && <div className="submission-execution-summary"><strong>{passed} / {execution.results.length} tests passed</strong><span>{formatMarks(execution.score ?? submission.score)} marks</span></div>}
                      {execution?.results?.map((test, testIndex) => <details className="submission-test-result" key={testIndex}><summary><span className={test.passed ? "is-passed" : "is-failed"}>{test.passed ? "Passed" : "Failed"}</span>Test case {testIndex + 1}</summary><pre>{JSON.stringify(test, null, 2)}</pre></details>)}
                      {submission.status === "ERROR" && <Button variant="secondary" onClick={() => retryCodeJob(submission)}>Retry code job</Button>}
                      <div className="submission-ai-review">
                        <div className="row between"><strong>AI review</strong>{aiReview && <Badge>{aiReview.status}</Badge>}</div>
                        {aiReview ? (
                          <>
                            {aiReview.review?.feedback && <p>{aiReview.review.feedback}</p>}
                            {aiReview.error && <p className="error">{aiReview.error}</p>}
                            <div className="form-grid submission-ai-scores">
                              {[ ["qualityScore", "Quality marks"], ["efficiencyScore", "Efficiency marks"] ].map(([key, label]) => <label className="field" key={key}>{label}<input type="number" min="0" step=".1" value={(aiDrafts[aiReview._id] || aiReview)[key] ?? 0} onChange={(event) => setAiDrafts((drafts) => ({ ...drafts, [aiReview._id]: { ...(drafts[aiReview._id] || aiReview), [key]: event.target.value } }))} /></label>)}
                            </div>
                            <div className="row wrap"><Button onClick={() => saveAiReview(aiReview, "APPROVED")}>Approve / save marks</Button><Button variant="secondary" onClick={() => saveAiReview(aiReview, "REJECTED")}>Reject review</Button></div>
                          </>
                        ) : <Button variant="secondary" onClick={() => requestAiReview(submission)}>Request optional AI review</Button>}
                      </div>
                    </div>
                  );
                })}
              </article>
            );
          })}
          <p className="muted submission-detail-note">Scores are shown in marks. Coding marks may remain pending until execution grading finishes.</p>
        </Modal>
      )}
    </>
  );
}
