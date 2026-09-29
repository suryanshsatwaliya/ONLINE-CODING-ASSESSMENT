export default function ProblemDescription({ question: q }) {
  return (
    <div className="problem-description">
      <h2>{q.title}</h2>
      <p className="preserve">{q.description}</p>
      {[
        ["Constraints", q.constraints],
        ["Input format", q.inputFormat],
        ["Output format", q.outputFormat],
      ].map(([label, v]) => (
        <section key={label}>
          <h3>{label}</h3>
          <p className="preserve">{v}</p>
        </section>
      ))}
      {q.examples.map((x, i) => (
        <div className="sample" key={i}>
          <h3>Example {i + 1}</h3>
          <small>INPUT</small>
          <pre>{x.input}</pre>
          <small>OUTPUT</small>
          <pre>{x.output}</pre>
        </div>
      ))}
    </div>
  );
}
