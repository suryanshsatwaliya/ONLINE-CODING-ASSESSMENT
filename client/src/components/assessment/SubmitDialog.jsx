import ConfirmDialog from "../common/ConfirmDialog";
export default function SubmitDialog(props) {
  return (
    <ConfirmDialog title="Submit assessment?" {...props}>
      Your saved answers and code drafts will be submitted for grading. You
      cannot edit them afterward.
    </ConfirmDialog>
  );
}
