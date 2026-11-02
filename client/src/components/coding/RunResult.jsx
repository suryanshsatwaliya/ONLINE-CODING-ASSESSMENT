export default function RunResult({ result }) {
  const hasCases = result?.total > 0;
  const allPassed = hasCases && result.passed === result.total;
  return result ? (
    <div className={`notice coding-run-summary${hasCases ? allPassed ? " is-passed" : " is-failed" : ""}`}>
      {result.status || "Run complete"}
      {result.total !== undefined && (
        <span>
          {" "}· {result.passed}/{result.total} {result.hidden ? "hidden test cases" : "test cases"} passed
        </span>
      )}
      {result.error && <p>{result.error}</p>}
    </div>
  ) : null;
}
