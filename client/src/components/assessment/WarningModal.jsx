import Modal from "../common/Modal";
import Button from "../common/Button";
export default function WarningModal({ warning, max, onReturn }) {
  return (
    <Modal title="Assessment warning">
      <div className="warning-symbol">!</div>
      <h2>{warning.eventType.replaceAll("_", " ")}</h2>
      <p>This action is restricted by the assessment rules.</p>
      <p className="warning-count">
        Warning {warning.warningCount} of {max}
      </p>
      <Button onClick={onReturn}>Return to assessment</Button>
    </Modal>
  );
}
