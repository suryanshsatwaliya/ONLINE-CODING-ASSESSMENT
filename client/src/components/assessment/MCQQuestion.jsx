export default function MCQQuestion({
  question: q,
  value = [],
  order,
  onChange,
}) {
  return (
    <div className="options">
      {(order || q.options.map((_, i) => i)).map((i) => (
        <label
          className={"answer-option " + (value.includes(i) ? "selected" : "")}
          key={i}
        >
          <input
            type={q.type === "MULTIPLE" ? "checkbox" : "radio"}
            name={q._id}
            checked={value.includes(i)}
            onChange={() =>
              onChange(
                q.type === "MULTIPLE"
                  ? value.includes(i)
                    ? value.filter((x) => x !== i)
                    : [...value, i]
                  : [i],
              )
            }
          />
          <span>{q.options[i]}</span>
        </label>
      ))}
    </div>
  );
}
