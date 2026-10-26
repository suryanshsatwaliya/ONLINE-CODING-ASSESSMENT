export default function TestCases({ cases }) {
  return (
    <div>
      {cases.map((t, i) => (
        <section className="coding-test-case" key={i}>
          <h4>Sample case {i + 1}</h4>
          <small>Input</small>
          <pre>{t.input}</pre>
          <small>Expected output</small>
          <pre>{t.expectedOutput}</pre>
        </section>
      ))}
      {!cases.length && <p>No visible test cases supplied.</p>}
    </div>
  );
}
