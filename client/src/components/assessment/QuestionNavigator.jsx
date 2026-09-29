export default function QuestionNavigator({
  questions,
  answers,
  current,
  onChange,
}) {
  return (
    <div className="question-nav">
      {questions.map((q, i) => {
        const a = answers[q._id];
        const v = a?.value;
        const answered = Array.isArray(v)
          ? v.length
          : typeof v === "object"
            ? v?.code
            : !!v;
        return (
          <button
            key={q._id}
            className={`${i === current ? "current" : ""} ${answered ? "answered" : ""} ${a?.marked ? "marked" : ""}`}
            onClick={() => onChange(i)}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
