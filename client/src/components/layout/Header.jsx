import { useAuth } from "../../hooks/useAuth";
import ThemeToggle from "../common/ThemeToggle";
import { PanelsTopLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
export default function Header() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const section = pathname.split("/").filter(Boolean)[1] || "dashboard";
  const titles = {
    dashboard: "Dashboard", students: "Students", assessments: "Assessments",
    questions: "Question bank", monitor: "Live monitor", submissions: "Submissions & results",
    settings: "Settings", "exam-preview": "Exam preview",
  };
  let title = titles[section] || "Assessment workspace";
  if (section === "assessments" && pathname !== "/teacher/assessments") {
    title = pathname.endsWith("/new") ? "Create assessment" : "Assessment editor";
  }
  if (section === "questions" && pathname !== "/teacher/questions") {
    title = pathname.includes("/test") ? "Test question" : pathname.includes("/sets/") ? "Question set" : "Edit question";
  }
  return (
    <header className="workspace-header workspace-header-redesign">
      <div className="workspace-context">
        <span className="workspace-context-icon"><PanelsTopLeft size={17} /></span>
        <span className="workspace-context-label">
          <strong>{title}</strong>
        </span>
      </div>
      <div className="row workspace-header-actions">
        <ThemeToggle />
        <div className="workspace-user">
          <span className="avatar">{user?.name?.[0]}</span>
          <span className="workspace-user-copy">
            <strong>{user?.name}</strong>
            <small>Teacher account</small>
          </span>
        </div>
      </div>
    </header>
  );
}
