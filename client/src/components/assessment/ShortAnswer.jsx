export default function ShortAnswer({ value = "", onChange }) {
  return (
    <textarea
      className="short-answer"
      rows="8"
      placeholder="Type your answer here…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
