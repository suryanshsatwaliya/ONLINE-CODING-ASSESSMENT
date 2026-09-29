export default function RunResult({ result }) {
  return result ? (
    <div className="notice">
      {result.status || "Run complete"}
      {result.total !== undefined && (
        <span>
          {" "}
          · {result.passed}/{result.total} hidden cases passed · {result.score}{" "}
          correctness marks
        </span>
      )}
      {result.error && <p>{result.error}</p>}
    </div>
  ) : null;
}
