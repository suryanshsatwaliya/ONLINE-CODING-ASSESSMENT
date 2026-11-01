import { useAuth } from "../../hooks/useAuth";
import ThemeToggle from "../common/ThemeToggle";
import { PanelsTopLeft } from "lucide-react";
export default function Header() {
  const { user } = useAuth();
  return (
    <header className="workspace-header workspace-header-redesign">
      <div className="workspace-context">
        <span className="workspace-context-icon"><PanelsTopLeft size={17} /></span>
        <span className="workspace-context-label">
          <strong>Assessment workspace</strong>
          <span className="workspace-context-divider">/</span>
          <span className="workspace-context-role">Teacher</span>
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
