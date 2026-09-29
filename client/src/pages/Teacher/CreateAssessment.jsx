import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
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
  const [form, F] = useState(structuredClone(blank)),
    [bank, B] = useState([]),
    [students, S] = useState([]),
    [assigned, A] = useState([]),
    [course, C] = useState(""),
    [section, Sec] = useState(""),
    [code, Code] = useState(""),
    [confirm, Confirm] = useState("");
  const locked = ["LIVE", "ENDED"].includes(form.status);
  useEffect(() => {
    Promise.all([
      api.get("/questions"),
      api.get("/students"),
      ...(id
        ? [
            api.get("/assessments/" + id),
            api.get("/assessments/" + id + "/assignments"),
          ]
        : []),
    ])
      .then(([q, s, a, as]) => {
        B(q.data);
        S(s.data);
        if (a)
          F({ ...a.data, questionIds: a.data.questions.map((q) => q._id) });
        if (as) A(as.data.map((x) => x.student?._id).filter(Boolean));
      })
      .catch((e) => toast(errorMessage(e)));
  }, [id]);
  const set = (k, v) => F({ ...form, [k]: v });
  async function save(e) {
    e.preventDefault();
    try {
      const { data } = id
        ? await api.put("/assessments/" + id, form)
        : await api.post("/assessments", form);
      toast("Assessment saved");
      if (id) F({ ...data, questionIds: data.questions.map((q) => q._id) });
      else nav("/teacher/assessments/" + data._id);
    } catch (e) {
      toast(errorMessage(e));
    }
  }
  async function action(path, body = {}) {
    try {
      const { data } = await api.post("/assessments/" + id + "/" + path, body);
      if (data.accessCode) Code(data.accessCode);
      else if (data.status)
        F({ ...data, questionIds: data.questions.map((q) => q._id) });
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
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">ASSESSMENT STUDIO</span>
          <h1>{id ? form.title : "Create assessment"}</h1>
          <p>Define the challenge, audience and assessment rules.</p>
        </div>
        <Badge>{form.status}</Badge>
      </div>
      {id && (
        <div className="card row wrap between">
          <div>
            <small>ASSESSMENT ID — SHARE WITH ASSIGNED STUDENTS</small>
            <code>{id}</code>
          </div>
          <div className="row">
            {!locked && (
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
                  F({ ...data, questionIds: data.questions.map((q) => q._id) });
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
      <form onSubmit={save}>
        <fieldset disabled={locked}>
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
                  onChange={(e) => set("type", e.target.value)}
                >
                  <option>QUIZ</option>
                  <option>CODING</option>
                  <option>MIXED</option>
                </select>
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
                      ? "Earliest teacher start (optional)"
                      : "Hard closing time (optional)"
                  }
                  type="datetime-local"
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
            <h2>02 / Questions</h2>
            <p>Select questions from the bank. Use arrows to set the order.</p>
            {bank.map((q) => (
              <label className="question-select" key={q._id}>
                <input
                  type="checkbox"
                  checked={form.questionIds.includes(q._id)}
                  onChange={(e) =>
                    set(
                      "questionIds",
                      e.target.checked
                        ? [...form.questionIds, q._id]
                        : form.questionIds.filter((x) => x !== q._id),
                    )
                  }
                />
                <strong>{q.title}</strong>
                <Badge>{q.type}</Badge>
                <span>{q.marks} marks</span>
              </label>
            ))}
            {!bank.length && (
              <p>Create questions in the Question Bank first.</p>
            )}
            <ol>
              {form.questionIds.map((qid, i) => (
                <li className="row between" key={qid}>
                  <span>
                    {i + 1}.{" "}
                    {bank.find((q) => q._id === qid)?.title ||
                      form.questions?.find((q) => q._id === qid)?.title}
                  </span>
                  <span>
                    {[-1, 1].map((d) => (
                      <button
                        type="button"
                        key={d}
                        disabled={i + d < 0 || i + d >= form.questionIds.length}
                        onClick={() => {
                          const arr = [...form.questionIds];
                          [arr[i], arr[i + d]] = [arr[i + d], arr[i]];
                          set("questionIds", arr);
                        }}
                      >
                        {d < 0 ? "↑" : "↓"}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
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
          {!locked && <Button>Save assessment</Button>}
        </fieldset>
      </form>
      {id && !locked && (
        <section className="card">
          <h2>04 / Assign students & access</h2>
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
            <Button variant="secondary" onClick={() => action("access-code")}>
              Generate / rotate access code
            </Button>
          </div>
          {code && (
            <div className="notice">
              <strong>
                Access code: <code>{code}</code>
              </strong>
              <p>
                Copy it now and share securely with assigned students. Only its
                hash is stored.
              </p>
            </div>
          )}
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
