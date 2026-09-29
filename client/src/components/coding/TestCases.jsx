export default function TestCases({ cases }) {
  return (
    <div>
      {cases.map((t, i) => (
        <details key={i}>
          <summary>Sample case {i + 1}</summary>
          <small>Input</small>
          <pre>{t.input}</pre>
          <small>Expected output</small>
          <pre>{t.expectedOutput}</pre>
        </details>
      ))}
      {!cases.length && <p>No visible test cases supplied.</p>}
    </div>
  );
}
