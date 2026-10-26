import { useState } from "react";
import { api, errorMessage } from "../../services/api";
import Input from "../common/Input";
import Button from "../common/Button";

export default function LeetcodeImport({ value, onChange, onBusy, onImported }) {
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const hasContent = Boolean(value.title || value.description || value.testCases.length);
  async function importProblem() {
    if (busy) return;
    setBusy(true);
    onBusy(true);
    setError("");
    setWarnings([]);
    try {
      const { data } = await api.post("/questions/import/leetcode", { reference });
      onChange({ ...value, ...data.question });
      onImported?.(data.question);
      setWarnings(data.warnings || []);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="leetcode-import">
      <h3>Import from LeetCode</h3>
      <p>Enter a number to fill the statement, constraints and public examples. You can also write the problem manually below.</p>
      <div className="row wrap">
        <Input label="LeetCode problem" placeholder="LeetCode 67" value={reference}
          disabled={busy} onChange={(e) => setReference(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (reference.trim()) importProblem(); } }} />
        <Button type="button" disabled={busy || !reference.trim()} onClick={importProblem}>
          {busy ? "Importing…" : hasContent ? "Import and replace content" : "Import problem"}
        </Button>
      </div>
      {hasContent && <small>Import replaces this question’s content, examples, tests and starter code. Marks are kept.</small>}
      <small>Imports public examples and their explanations. Add your own hidden tests before using the set in an assessment.</small>
      {error && <p className="error" role="alert">{error}</p>}
      {!!warnings.length && <div className="notice" role="status">
        <strong>Problem imported — review before saving</strong>
        {warnings.map((warning) => <p key={warning}>{warning}</p>)}
      </div>}
    </section>
  );
}
