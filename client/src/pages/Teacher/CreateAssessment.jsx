import { updateAssessmentTiming } from "../../utils/assessmentTiming";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import AssessmentAccess from "../../components/teacher/AssessmentAccess";
import DeleteAssessmentButton from "../../components/teacher/DeleteAssessmentButton";
import { useAssessmentUpdates } from "../../hooks/useAssessmentUpdates";
import AssessmentQuestionPicker, { assessmentForm, availableSets, questionCount as countQuestions } from "../../components/teacher/AssessmentQuestionPicker";
import SecuritySettings, {
  defaultSecurity,
} from "../../components/teacher/SecuritySettings";
const blank = {
  title: "",
  description: "",
  instructions: "",
  type: "MIXED",
  duration: 60,
  startTime: null,
  endTime: null,
  status: "DRAFT",
  questionIds: [],
  questionSetIds: [],
  securitySettings: defaultSecurity,
  randomizeQuestions: false,
  randomizeOptions: false,
  publishResults: false,
  aiEnabled: false,
  aiRubric: "Assess code quality, readability and algorithmic efficiency.",
  maxCodeRuns: 0,
};
export default function CreateAssessment() {
  const { id } = useParams(),
    nav = useNavigate(),
    toast = useToast();
  const [form, F] = useState(() => structuredClone(blank)),
    [bank, B] = useState([]),
    [sets, setSets] = useState([]),
    [students, S] = useState([]),
    [assigned, A] = useState([]),
    [course, C] = useState(""),
    [section, Sec] = useState(""),
    [confirm, Confirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const savePending = useRef(false);
  const lastServerStatus = useRef(null);
  const locked = ["LIVE", "ENDED"].includes(form.status);
  const questionCount = countQuestions(sets, form);
  useAssessmentUpdates(useCallback(() => {
    if (!id) return;
    api.get("/assessments/" + id).then(({ data }) => {
      if (lastServerStatus.current && lastServerStatus.current !== data.status) F(assessmentForm(data));
      lastServerStatus.current = data.status;
    }).catch(() => {});
  }, [id]));
  const refreshQuestions = useCallback(async () => {
    const [questions, library] = await Promise.all([api.get("/questions"), api.get("/question-sets")]);
    B(questions.data); setSets(library.data);
  }, []);
  useEffect(() => {
    Promise.all([
      api.get("/questions"),
      api.get("/students"),
      api.get("/question-sets"),
      ...(id
        ? [
            api.get("/assessments/" + id),
            api.get("/assessments/" + id + "/assignments"),
          ]
        : []),
    ])
      .then(([q, s, questionSets, a, as]) => {
        B(q.data);
        S(s.data);
        setSets(questionSets.data);
        if (a) {
          lastServerStatus.current = a.data.status;
          F(assessmentForm(a.data));
        }
        if (as) A(as.data.map((x) => x.student?._id).filter(Boolean));
      })
      .catch((e) => setLoadError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);
  const set = (k, v) => F((previous) => updateAssessmentTiming(previous, k, v));
  async function save(e) {
    e.preventDefault();
    if (savePending.current) return;
    setSaveError("");
    if (!questionCount && !id) {
      setSaveError("Select at least one saved question set or individual question.");
      return;
    }
    savePending.current = true;
    setSaving(true);
    try {
      const { data } = id
        ? await api.put("/assessments/" + id, form)
        : await api.post("/assessments", form);
      toast("Assessment saved");
      if (id) {
        lastServerStatus.current = data.status;
        F(assessmentForm(data));
      }
      else nav("/teacher/assessments/" + data._id);
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  }
  async function action(path, body = {}) {
    try {
      const { data } = await api.post("/assessments/" + id + "/" + path, body);
      if (data.status)
        F(assessmentForm(data));
      toast(
        path === "assign"
          ? `Assigned ${data.assigned} students`
          : "Changes saved",
      );
      Confirm("");
    } catch (e) {
      toast(errorMessage(e));
    }
  }
  if (loading) return <p role="status">Loading assessment options…</p>;
  if (loadError) return <p role="alert" className="error notice">{loadError}</p>;
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">ASSESSMENT STUDIO</span>
          <h1>{id ? form.title : "Create assessment"}</h1>
          <p>Choose saved question sets, configure the assessment and invite your students.</p>
        </div>
        <Badge>{form.status}</Badge>
      </div>
      {id && (
        <div className="card row wrap between">
          <div>
            <strong>Assessment controls</strong>
            <small>Manage the session and result visibility.</small>
            {form.status === "SCHEDULED" && form.startTime && <small>Starts automatically at {new Date(form.startTime).toLocaleString()}. Assign students and generate an access code before then.</small>}
            {form.status === "LIVE" && form.closesAt && <small>Automatically ends at {new Date(form.closesAt).toLocaleString()}, or when all assigned students finish.</small>}
            {form.status === "ENDED" && form.endReason && <small>{form.endReason === "ALL_FINISHED" ? "Ended automatically: all assigned students finished." : form.endReason === "TIME_EXPIRED" ? "Ended automatically: assessment time expired." : "Ended by teacher."}</small>}
          </div>
          <div className="row">
            <DeleteAssessmentButton assessment={{ ...form, _id: id }} onDeleted={() => nav("/teacher/assessments", { replace: true })} />
            {!locked && !(form.status === "SCHEDULED" && form.startTime) && (
              <Button onClick={() => Confirm("start")}>Start assessment</Button>
            )}
            {form.status === "LIVE" && (
              <Button variant="danger" onClick={() => Confirm("end")}>
                End assessment
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const { data } = await api.patch(
                    "/assessments/" + id + "/publish",
                    { publishResults: !form.publishResults },
                  );
                  F((previous) => ({ ...previous, publishResults: data.publishResults }));
                  toast("Result visibility updated");
                } catch (e) {
                  toast(errorMessage(e));
                }
              }}
            >
              {form.publishResults ? "Unpublish results" : "Publish results"}
            </Button>
          </div>
        </div>
      )}
      {id && <AssessmentAccess key={id} id={id} status={form.status} />}
      <form onSubmit={save}>
        <fieldset disabled={locked || saving}>
          <section className="card">
            <h2>01 / Assessment details</h2>
            <div className="form-grid">
              <Input
                label="Title"
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
              <label className="field">
                Assessment type
                <select
                  value={form.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    const compatible = (q) => type === "MIXED" || (type === "CODING" ? q.type === "CODING" : q.type !== "CODING");
                    F({ ...form, type,
                      questionSetIds: form.questionSetIds.filter((id) => availableSets(sets, form).some((set) => set._id === id && (type === "MIXED" || set.type === type))),
                      questionIds: form.questionIds.filter((id) => [...bank, ...(form.questions || [])].some((q) => q._id === id && compatible(q))),
                    });
                  }}
                >
                  <option>QUIZ</option>
                  <option>CODING</option>
                  <option>MIXED</option>
                </select>
                <small>Only compatible saved sets are shown. Changing type removes incompatible selections.</small>
              </label>
              <Input
                label="Duration (minutes)"
                type="number"
                min="1"
                max="480"
                value={form.duration}
                onChange={(e) => set("duration", +e.target.value)}
              />
              <label className="field">
                Status
                <select
                  value={locked ? "DRAFT" : form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option>DRAFT</option>
                  <option>SCHEDULED</option>
                </select>
              </label>
              {["startTime", "endTime"].map((k) => (
                <Input
                  key={k}
                  label={
                    k === "startTime"
                      ? "Scheduled start time (optional)"
                      : "Hard closing time (optional)"
                  }
                  type="datetime-local"
                  readOnly={k === "endTime" && Boolean(form.startTime)}
                  value={
                    form[k]
                      ? new Date(
                          new Date(form[k]).getTime() -
                            new Date(form[k]).getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    set(
                      k,
                      e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    )
                  }
                />
              ))}
            </div>
            {["description", "instructions"].map((k) => (
              <label className="field" key={k}>
                {k}
                <textarea
                  value={form[k]}
                  onChange={(e) => set(k, e.target.value)}
                />
              </label>
            ))}
          </section>
          <section className="card">
            <AssessmentQuestionPicker sets={sets} bank={bank} form={form} onChange={F} onRefresh={locked ? undefined : refreshQuestions} />
            <div className="row wrap">
              {["randomizeQuestions", "randomizeOptions", "aiEnabled"].map(
                (k) => (
                  <label className="check" key={k}>
                    <input
                      type="checkbox"
                      checked={form[k]}
                      onChange={(e) => set(k, e.target.checked)}
                    />
                    {k.replace(/([A-Z])/g, " $1")}
                  </label>
                ),
              )}
            </div>
            {form.aiEnabled && (
              <label className="field">
                AI rubric (teacher approval required)
                <textarea
                  value={form.aiRubric}
                  onChange={(e) => set("aiRubric", e.target.value)}
                />
              </label>
            )}
            <Input
              label="Maximum code runs/submissions per attempt (0 = unlimited)"
              type="number"
              min="0"
              value={form.maxCodeRuns}
              onChange={(e) => set("maxCodeRuns", +e.target.value)}
            />
          </section>
          <section className="card">
            <h2>03 / Assessment security</h2>
            <SecuritySettings
              value={form.securitySettings}
              onChange={(v) => set("securitySettings", v)}
            />
          </section>
          {saveError && <p className="error notice" role="alert">{saveError}</p>}
          {!locked && <Button disabled={saving || questionCount > 100}>{saving ? "Saving assessment…" : "Save assessment"}</Button>}
        </fieldset>
      </form>
      {id && !locked && (
        <section className="card">
          <h2>04 / Assign students</h2>
          <p>
            Save assignment separately. Selected students plus matching
            course/section are included.
          </p>
          <div className="form-grid">
            <Input
              label="Include course (optional)"
              value={course}
              onChange={(e) => C(e.target.value)}
            />
            <Input
              label="Include section (optional)"
              value={section}
              onChange={(e) => Sec(e.target.value)}
            />
          </div>
          <div className="assignment-list">
            {students.map((s) => (
              <label className="check" key={s._id}>
                <input
                  type="checkbox"
                  checked={assigned.includes(s._id)}
                  onChange={(e) =>
                    A(
                      e.target.checked
                        ? [...assigned, s._id]
                        : assigned.filter((x) => x !== s._id),
                    )
                  }
                />
                {s.name} · {s.uid} · {s.section}
              </label>
            ))}
          </div>
          <div className="row wrap">
            <Button
              onClick={() =>
                action("assign", {
                  studentIds: assigned,
                  ...(course ? { course } : {}),
                  ...(section ? { section } : {}),
                })
              }
            >
              Save assignment
            </Button>
          </div>
        </section>
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm === "start" ? "Start assessment?" : "End assessment?"}
          onClose={() => Confirm("")}
          onConfirm={() => action(confirm)}
        >
          {confirm === "start"
            ? "Students can begin immediately. Questions and settings will become locked."
            : "Saved answers will be submitted. Further student changes will be blocked."}
        </ConfirmDialog>
      )}
    </>
  );
}

