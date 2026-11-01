export default function TestCases({ cases, results = [] }) {
  return (
    <div>
      {cases.map((t, i) => (
        <section className={`coding-test-case${results?.[i] ? results[i].passed ? " is-passed" : " is-failed" : ""}`} key={i}>
          <h4>
            <span>Sample case {i + 1}</span>
            {results?.[i] && <span className="coding-case-status">{results[i].passed ? "Passed" : "Failed"}</span>}
          </h4>
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
