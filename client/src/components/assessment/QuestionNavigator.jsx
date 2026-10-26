export default function QuestionNavigator({
  questions,
  answers,
  current,
  visited,
  onChange,
  indexes,
  labelPrefix = "Question",
}) {
  return (
    <div className="question-nav">
      {questions.map((q, i) => {
        const originalIndex = indexes?.[i] ?? i;
        const a = answers[q._id];
        const v = a?.value;
        const answered = Array.isArray(v)
          ? v.length > 0
          : typeof v === "object"
            ? Boolean(v?.code?.trim())
            : Boolean(String(v ?? "").trim());
        const skipped = !answered && originalIndex !== current && visited?.has(originalIndex);
        return (
          <button
            key={q._id}
            aria-label={`${labelPrefix} ${i + 1}${answered ? ", answered" : skipped ? ", skipped" : ", unanswered"}${a?.marked ? ", marked for review" : ""}`}
            aria-current={originalIndex === current ? "step" : undefined}
            className={`${originalIndex === current ? "current" : ""} ${answered ? "answered" : skipped ? "skipped" : ""} ${a?.marked ? "marked" : ""}`}
            onClick={() => onChange(originalIndex)}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
