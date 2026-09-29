import Input from "../common/Input";
import Button from "../common/Button";
import CodingProblemBuilder from "./CodingProblemBuilder";
import { questionTypes } from "../../utils/constants";
export const blankQuestion = {
  title: "",
  question: "",
  type: "SINGLE",
  marks: 10,
  negativeMarks: 0,
  options: ["", ""],
  correctAnswer: [0],
  explanation: "",
  description: "",
  difficulty: "EASY",
  constraints: "",
  inputFormat: "",
  outputFormat: "",
  examples: [],
  starterCode: {},
  supportedLanguages: ["python", "cpp", "java", "c", "javascript"],
  timeLimit: 2,
  memoryLimit: 128000,
  testCases: [],
  source: "MANUAL",
  externalReference: "",
  tags: [],
  qualityMarks: 0,
  efficiencyMarks: 0,
};
export default function QuestionBuilder({ value: q, onChange, onSubmit }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <Input
          label="Title"
          required
          value={q.title}
          onChange={(e) => set("title", e.target.value)}
        />
        <label className="field">
          Question type
          <select
            value={q.type}
            onChange={(e) =>
              onChange({
                ...q,
                type: e.target.value,
                correctAnswer: e.target.value === "SHORT" ? "" : [0],
                options:
                  e.target.value === "TRUE_FALSE"
                    ? ["True", "False"]
                    : q.options,
              })
            }
          >
            {questionTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <Input
          label="Marks (deterministic)"
          type="number"
          min=".1"
          step=".1"
          value={q.marks}
          onChange={(e) => set("marks", +e.target.value)}
        />
        <Input
          label="Negative marks"
          type="number"
          min="0"
          step=".1"
          value={q.negativeMarks}
          onChange={(e) => set("negativeMarks", +e.target.value)}
        />
        <label className="field">
          Difficulty
          <select
            value={q.difficulty}
            onChange={(e) => set("difficulty", e.target.value)}
          >
            <option>EASY</option>
            <option>MEDIUM</option>
            <option>HARD</option>
          </select>
        </label>
        <label className="field">
          Source
          <select
            value={q.source}
            onChange={(e) => set("source", e.target.value)}
          >
            <option>MANUAL</option>
            <option>INTERNAL</option>
            <option>EXTERNAL</option>
          </select>
        </label>
      </div>
      {q.source === "EXTERNAL" && (
        <Input
          label="External reference (e.g. LeetCode 45; provide permitted content yourself)"
          value={q.externalReference}
          onChange={(e) => set("externalReference", e.target.value)}
        />
      )}
      <Input
        label="Search tags (comma separated)"
        value={q.tags.join(",")}
        onChange={(e) =>
          set(
            "tags",
            e.target.value.split(",").map((x) => x.trim()),
          )
        }
      />
      {q.type === "CODING" ? (
        <CodingProblemBuilder value={q} onChange={onChange} />
      ) : (
        <>
          <label className="field">
            Question
            <textarea
              required
              value={q.question}
              onChange={(e) => set("question", e.target.value)}
            />
          </label>
          {q.type === "SHORT" ? (
            <Input
              label="Reference answer (case-insensitive exact match)"
              required
              value={q.correctAnswer}
              onChange={(e) => set("correctAnswer", e.target.value)}
            />
          ) : (
            <>
              <h3>Options · select correct answer(s)</h3>
              {q.options.map((o, i) => (
                <div className="row option-edit" key={i}>
                  <input
                    type={q.type === "MULTIPLE" ? "checkbox" : "radio"}
                    name="correct"
                    checked={q.correctAnswer.includes(i)}
                    onChange={() =>
                      set(
                        "correctAnswer",
                        q.type === "MULTIPLE"
                          ? q.correctAnswer.includes(i)
                            ? q.correctAnswer.filter((x) => x !== i)
                            : [...q.correctAnswer, i]
                          : [i],
                      )
                    }
                  />
                  <input
                    required
                    value={o}
                    onChange={(e) =>
                      set(
                        "options",
                        q.options.map((x, j) => (i === j ? e.target.value : x)),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...q,
                        options: q.options.filter((_, j) => i !== j),
                        correctAnswer: [],
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set("options", [...q.options, ""])}
              >
                + Add option
              </button>
            </>
          )}
          <label className="field">
            Explanation
            <textarea
              value={q.explanation}
              onChange={(e) => set("explanation", e.target.value)}
            />
          </label>
        </>
      )}
      <div className="row end">
        <Button>Save question</Button>
      </div>
    </form>
  );
}
