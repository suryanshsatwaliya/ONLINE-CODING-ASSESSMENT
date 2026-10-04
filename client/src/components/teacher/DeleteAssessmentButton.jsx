import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { assessmentService } from "../../services/assessmentService";
import { errorMessage } from "../../services/api";
import { useToast } from "../common/Toast";
import Modal from "../common/Modal";
import Button from "../common/Button";

export default function DeleteAssessmentButton({ assessment, onDeleted }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const pending = useRef(false), trigger = useRef(null);
  const toast = useToast();
  if (!["DRAFT", "SCHEDULED"].includes(assessment.status)) return null;
  function close() {
    if (pending.current) return;
    setOpen(false); setError(""); trigger.current?.focus();
  }
  async function remove() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await assessmentService.remove(assessment._id);
      setOpen(false);
      toast("Assessment deleted");
      onDeleted(assessment._id);
    } catch (e) { setError(errorMessage(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <>
    <button ref={trigger} type="button" className="assessment-delete-trigger" aria-label={`Delete assessment: ${assessment.title}`} onClick={() => setOpen(true)}><Trash2 size={15} />Delete</button>
    {open && createPortal(<Modal title="Delete assessment?" onClose={close}>
      <p>Delete <strong>{assessment.title}</strong> and its student assignments? This cannot be undone. Saved questions in your Question Bank will remain available.</p>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="row end">
        <Button type="button" variant="secondary" autoFocus disabled={busy} onClick={close}>Cancel</Button>
        <Button type="button" variant="danger" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete assessment"}</Button>
      </div>
    </Modal>, document.body)}
  </>;
}
