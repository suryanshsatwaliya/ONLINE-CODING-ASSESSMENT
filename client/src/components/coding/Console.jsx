export default function Console({ result }) {
  return (
    <div className="console">
      {result?.results?.map((r, i) => (
        <section key={i}>
          <strong>
            Case {i + 1} · {r.status}
          </strong>
          <pre>{r.compileOutput || r.stderr || r.stdout || "(no output)"}</pre>
          <small>
            {r.time || "—"} s · {r.memory || "—"} KB
          </small>
        </section>
      ))}
      {!result && <p>Run your code to see sample execution output.</p>}
    </div>
  );
}
