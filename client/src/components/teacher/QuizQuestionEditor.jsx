import { useId } from "react";
import Input from "../common/Input";

export default function QuizQuestionEditor({ value: q, onChange }) {
  const group = useId();
  const set = (key, value) => onChange({ ...q, [key]: value });
  return (
    <>
      <label className="field">Question
        <textarea required rows={3} placeholder="What would you like to ask?" value={q.question}
          onChange={(e) => onChange({ ...q, question: e.target.value, title: e.target.value.trim().slice(0, 200) })} />
      </label>
      <div className="form-grid">
        <label className="field">Answer type
          <select value={q.type} onChange={(e) => onChange({ ...q, type: e.target.value, correctAnswer: [0], options: e.target.value === "TRUE_FALSE" ? ["True", "False"] : ["", ""] })}>
            <option value="SINGLE">Multiple choice · one answer</option>
            <option value="MULTIPLE">Checkboxes · multiple answers</option>
            <option value="TRUE_FALSE">True / False</option>
          </select>
        </label>
        <Input label="Points" type="number" required min="0.1" max="1000" step="0.1" value={q.marks || ""} onChange={(e) => set("marks", e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
      <p className="answer-hint">{q.type === "MULTIPLE" ? "Select every correct answer." : "Select the correct answer."}</p>
      {q.options.map((option, index) => (
        <div className={`quiz-option ${q.correctAnswer.includes(index) ? "is-correct" : ""}`} key={index}>
          <input type={q.type === "MULTIPLE" ? "checkbox" : "radio"} name={group}
            aria-label={`Option ${index + 1} is correct`} checked={q.correctAnswer.includes(index)}
            onChange={() => set("correctAnswer", q.type === "MULTIPLE"
              ? q.correctAnswer.includes(index) ? q.correctAnswer.filter((i) => i !== index) : [...q.correctAnswer, index]
              : [index])} />
          <input aria-label={`Option ${index + 1}`} required maxLength={2000} placeholder={`Option ${index + 1}`} value={option}
            readOnly={q.type === "TRUE_FALSE"} onChange={(e) => set("options", q.options.map((item, i) => i === index ? e.target.value : item))} />
          {q.type !== "TRUE_FALSE" && <button type="button" aria-label={`Delete option ${index + 1}`} disabled={q.options.length <= 2}
            onClick={() => onChange({ ...q, options: q.options.filter((_, i) => i !== index), correctAnswer: q.correctAnswer.filter((i) => i !== index).map((i) => i > index ? i - 1 : i) })}>×</button>}
        </div>
      ))}
      {q.type !== "TRUE_FALSE" && <button className="add-option" type="button" disabled={q.options.length >= 20} onClick={() => set("options", [...q.options, ""])}>+ Add option</button>}
      <details className="question-extra"><summary>Answer explanation & scoring</summary>
        <label className="field">Answer explanation (optional)<textarea value={q.explanation} onChange={(e) => set("explanation", e.target.value)} /></label>
        <Input label="Negative points (optional)" type="number" min="0" max="100" step="0.1" value={q.negativeMarks || ""} onChange={(e) => set("negativeMarks", +e.target.value)} />
      </details>
    </>
  );
}
