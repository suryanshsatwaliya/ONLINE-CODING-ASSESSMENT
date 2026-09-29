import Timer from "./Timer";
import Button from "../common/Button";
export default function AssessmentHeader({
  title,
  name,
  seconds,
  warnings,
  max,
  connected,
  onSubmit,
}) {
  return (
    <header className="exam-header">
      <div>
        <strong>{title}</strong>
        <small>{name}</small>
      </div>
      <div className="row wrap">
        <Timer seconds={seconds} />
        <span>
          Warnings{" "}
          <strong>
            {warnings} / {max}
          </strong>
        </span>
        <span className={"connection " + (connected ? "" : "offline")}>
          {connected ? "● Connected" : "● Connection lost"}
        </span>
        <Button onClick={onSubmit}>Submit assessment</Button>
      </div>
    </header>
  );
}
