import { useEffect, useState } from "react";
import Input from "../common/Input";
export default function CodingProblemBuilder({ value: q, onChange }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  const languages = ["python", "javascript", "cpp", "java", "c"];
  const labels = { python: "Python", javascript: "JavaScript", cpp: "C++", java: "Java", c: "C" };
  const [activeLanguage, setActiveLanguage] = useState(() =>
    q.supportedLanguages.includes("python") ? "python" : q.supportedLanguages[0] || "python",
  );
  useEffect(() => {
    if (q.externalReference)
      setActiveLanguage(q.supportedLanguages.includes("python") ? "python" : q.supportedLanguages[0] || "python");
  }, [q.externalReference]);
  return (
    <>
      <div className="coding-statement-fields">
        {["description", "constraints", "inputFormat", "outputFormat"].map(
          (k) => (
            <label className="field" key={k}>
              {{ description: "Problem statement", constraints: "Constraints (optional)", inputFormat: "Input format", outputFormat: "Output format" }[k]}
              <textarea
                rows={k === "description" ? 6 : 3}
                required={k === "description"}
                value={q[k]}
                onChange={(e) => set(k, e.target.value)}
              />
            </label>
          ),
        )}
      </div>
      <details className="question-extra">
      <summary>Languages, starter code & execution settings</summary>
      <div className="form-grid">
        <Input
          label="Time limit (seconds)"
          type="number"
          min=".1"
          max="5"
          step=".1"
          value={q.timeLimit}
          onChange={(e) => set("timeLimit", +e.target.value)}
        />
        <Input
          label="Memory limit (KB)"
          type="number"
          value={q.memoryLimit}
          onChange={(e) => set("memoryLimit", +e.target.value)}
        />
        <Input
          label="Quality marks (optional AI rubric)"
          type="number"
          value={q.qualityMarks || ""}
          onChange={(e) => set("qualityMarks", +e.target.value)}
        />
        <Input
          label="Efficiency marks (optional AI rubric)"
          type="number"
          value={q.efficiencyMarks || ""}
          onChange={(e) => set("efficiencyMarks", +e.target.value)}
        />
      </div>
      <h3>Languages & starter code</h3>
      <div className="coding-language-editor">
        <div className="coding-language-tabs" aria-label="Starter code language">
          {languages.map((language) => {
            const enabled = q.supportedLanguages.includes(language);
            return (
              <div className={`coding-language-option ${activeLanguage === language ? "active" : ""}`} key={language}>
                <button
                  type="button"
                  className="coding-language-tab"
                  aria-pressed={activeLanguage === language}
                  onClick={() => setActiveLanguage(language)}
                >
                  {labels[language]}
                </button>
                <label className="coding-language-toggle" title={`${enabled ? "Disable" : "Enable"} ${labels[language]}`}>
                  <input
                    type="checkbox"
                    aria-label={`${enabled ? "Disable" : "Enable"} ${labels[language]}`}
                    checked={enabled}
                    onChange={(e) => set(
                      "supportedLanguages",
                      e.target.checked
                        ? [...q.supportedLanguages, language]
                        : q.supportedLanguages.filter((item) => item !== language),
                    )}
                  />
                  <span aria-hidden="true" />
                </label>
              </div>
            );
          })}
        </div>
        <section className="coding-language-panel" aria-label={`${labels[activeLanguage]} starter code`}>
          <div className="coding-language-panel-heading">
            <strong>{labels[activeLanguage]} starter code</strong>
          </div>
          <textarea
            className="code-input"
            aria-label={`${labels[activeLanguage]} starter code`}
            value={q.starterCode[activeLanguage] || ""}
            onChange={(e) => set("starterCode", { ...q.starterCode, [activeLanguage]: e.target.value })}
          />
        </section>
      </div>
      </details>
      <h3>Examples</h3>
      {q.examples.map((t, i) => (
        <div className="form-grid" key={i}>
          <label className="field">Example input
          <textarea
            rows="3"
            value={t.input}
            onChange={(e) =>
              set(
                "examples",
                q.examples.map((x, j) =>
                  i === j ? { ...x, input: e.target.value } : x,
                ),
              )
            }
          />
          </label>
          <label className="field">Example output
          <textarea
            rows="3"
            value={t.output}
            onChange={(e) =>
              set(
                "examples",
                q.examples.map((x, j) =>
                  i === j ? { ...x, output: e.target.value } : x,
                ),
              )
            }
          />
          </label>
          <label className="field">Explanation (optional)
            <textarea rows={2} value={t.explanation || ""} onChange={(e) => set("examples", q.examples.map((x, j) => i === j ? { ...x, explanation: e.target.value } : x))} />
          </label>
          <button
            type="button"
            onClick={() =>
              set(
                "examples",
                q.examples.filter((_, j) => j !== i),
              )
            }
          >
            Remove example
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          set("examples", [...q.examples, { input: "", output: "", explanation: "" }])
        }
      >
        + Add example
      </button>
      <h3>Test cases</h3>
      <p className="muted">
        Visible cases are used for Run Code. Add at least one hidden grading case before using this problem in an assessment.
      </p>
      {q.testCases.map((t, i) => (
        <div className="test-builder" key={i}>
          <div className="form-grid">
            <label className="field">
              Input
              <textarea
                value={t.input}
                onChange={(e) =>
                  set(
                    "testCases",
                    q.testCases.map((x, j) =>
                      i === j ? { ...x, input: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label className="field">
              Expected output
              <textarea
                value={t.expectedOutput}
                onChange={(e) =>
                  set(
                    "testCases",
                    q.testCases.map((x, j) =>
                      i === j ? { ...x, expectedOutput: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
          </div>
          <div className="row">
            <label className="check">
              <input
                type="checkbox"
                checked={t.hidden}
                onChange={(e) =>
                  set(
                    "testCases",
                    q.testCases.map((x, j) =>
                      i === j ? { ...x, hidden: e.target.checked } : x,
                    ),
                  )
                }
              />
              Hidden
            </label>
            <Input
              label="Weight"
              type="number"
              min="1"
              value={t.weight}
              onChange={(e) =>
                set(
                  "testCases",
                  q.testCases.map((x, j) =>
                    i === j ? { ...x, weight: +e.target.value } : x,
                  ),
                )
              }
            />
            <button
              type="button"
              onClick={() =>
                set(
                  "testCases",
                  q.testCases.filter((_, j) => i !== j),
                )
              }
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          set("testCases", [
            ...q.testCases,
            { input: "", expectedOutput: "", hidden: true, weight: 1 },
          ])
        }
      >
        + Add test case
      </button>
    </>
  );
}
