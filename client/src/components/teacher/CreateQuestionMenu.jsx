import { Link } from "react-router-dom";
import { ClipboardList, Code2, ChevronDown } from "lucide-react";

export default function CreateQuestionMenu() {
  return (
    <details className="create-assessment-menu" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary").focus();
      }
    }}>
      <summary className="btn">+ Create Question <ChevronDown size={16} /></summary>
      <div className="assessment-menu-options">
        <Link to="/teacher/questions/new/quiz"><ClipboardList size={22} />
          <span><strong>Quiz (MCQ)</strong><small>Questions, options and correct answers</small></span>
        </Link>
        <Link to="/teacher/questions/new/coding"><Code2 size={22} />
          <span><strong>Coding</strong><small>Write or import reusable problems</small></span>
        </Link>
      </div>
    </details>
  );
}
