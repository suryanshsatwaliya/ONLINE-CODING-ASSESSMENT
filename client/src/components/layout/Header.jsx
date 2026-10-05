import { useAuth } from "../../hooks/useAuth";
import ThemeToggle from "../common/ThemeToggle";
export default function Header() {
  const { user } = useAuth();
  return (
    <header className="workspace-header">
      <span>
        Assessment workspace <span className="muted">/ Teacher</span>
      </span>
      <div className="row">
        <ThemeToggle />
        <span className="avatar">{user?.name?.[0]}</span>
        <div>
          <strong>{user?.name}</strong>
          <small>Teacher account</small>
        </div>
      </div>
    </header>
  );
}
