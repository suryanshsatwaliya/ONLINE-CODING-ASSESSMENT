import Modal from "./Modal";
import Button from "./Button";
export default function ConfirmDialog({
  title = "Confirm action",
  children,
  onConfirm,
  onClose,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{children}</p>
      <div className="row end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>Confirm</Button>
      </div>
    </Modal>
  );
}
