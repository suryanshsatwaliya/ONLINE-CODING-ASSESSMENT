import { formatTime } from "../../utils/formatTime";
export default function Timer({ seconds }) {
  return (
    <span className={"timer " + (seconds < 60 ? "urgent" : "")}>
      {formatTime(seconds)}
    </span>
  );
}
