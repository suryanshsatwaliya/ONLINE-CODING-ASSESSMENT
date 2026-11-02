export default function Console({ result, cases }) {
  if (!result) return null;
  return (
    <div className="coding-result-list" aria-label="Test case results">
      {result?.results?.map((r, i) => (
        <section className={`coding-result-case${r.passed ? " is-passed" : " is-failed"}`} key={i}>
          <div className="coding-result-case-heading">
            <span className="coding-result-icon" aria-hidden="true">{r.passed ? "✓" : "×"}</span>
            <strong>Test case {i + 1} {r.passed ? "passed" : "failed"}</strong>
            {!result.hidden && r.status && <small>{r.status}</small>}
          </div>
          {!result.hidden && cases?.[i] ? (
            <div className="coding-result-outputs">
              <section className="coding-result-expected">
                <strong>Expected output</strong>
                <pre>{cases[i].expectedOutput || "—"}</pre>
              </section>
              <section className={`coding-result-actual ${r.passed ? "is-match" : "is-mismatch"}`}>
                <strong>Your output</strong>
                <pre>{r.compileOutput || r.stderr || r.stdout || "No output produced."}</pre>
              </section>
            </div>
          ) : !result.hidden && (r.compileOutput || r.stderr || r.stdout) && (
            <pre>{r.compileOutput || r.stderr || r.stdout}</pre>
          )}
          {!result.hidden && <small className="coding-result-metrics">{r.time || "—"} s · {r.memory || "—"} KB</small>}
        </section>
      ))}
    </div>
  );
}
