import Input from "../common/Input";
export default function CodingProblemBuilder({ value: q, onChange }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  return (
    <>
      <div className="form-grid">
        {["description", "constraints", "inputFormat", "outputFormat"].map(
          (k) => (
            <label className="field" key={k}>
              {k}
              <textarea
                rows="3"
                value={q[k]}
                onChange={(e) => set(k, e.target.value)}
              />
            </label>
          ),
        )}
      </div>
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
          value={q.qualityMarks}
          onChange={(e) => set("qualityMarks", +e.target.value)}
        />
        <Input
          label="Efficiency marks (optional AI rubric)"
          type="number"
          value={q.efficiencyMarks}
          onChange={(e) => set("efficiencyMarks", +e.target.value)}
        />
      </div>
      <h3>Languages & starter code</h3>
      {["c", "cpp", "java", "python", "javascript"].map((l) => (
        <details key={l}>
          <summary>{l}</summary>
          <label className="check">
            <input
              type="checkbox"
              checked={q.supportedLanguages.includes(l)}
              onChange={(e) =>
                set(
                  "supportedLanguages",
                  e.target.checked
                    ? [...q.supportedLanguages, l]
                    : q.supportedLanguages.filter((x) => x !== l),
                )
              }
            />
            Enabled
          </label>
          <textarea
            className="code-input"
            value={q.starterCode[l] || ""}
            onChange={(e) =>
              set("starterCode", { ...q.starterCode, [l]: e.target.value })
            }
          />
        </details>
      ))}
      <h3>Examples</h3>
      {q.examples.map((t, i) => (
        <div className="form-grid" key={i}>
          <Input
            label="Example input"
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
          <Input
            label="Example output"
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
          set("examples", [...q.examples, { input: "", output: "" }])
        }
      >
        + Add example
      </button>
      <h3>Test cases</h3>
      <p className="muted">
        At least one hidden test is required. Use visible cases for Run Code.
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
