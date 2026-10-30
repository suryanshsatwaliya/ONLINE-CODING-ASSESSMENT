import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Library,
  Radio,
  FileCode,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
const items = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["students", "Students", Users],
  ["assessments", "Assessments", ClipboardList],
  ["questions", "Question Bank", Library],
  ["monitor", "Live Monitor", Radio],
  ["submissions", "Submissions & results", FileCode],
  ["settings", "Settings", Settings],
];
export default function Sidebar() {
  const { logout } = useAuth(),
    nav = useNavigate();
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-icon">
          <ShieldCheck />
        </span>
        Assess / Portal
      </div>
      <p className="nav-label">TEACHER WORKSPACE</p>
      <nav className="sidebar-nav-panel">
        {items.map(([path, label, Icon]) => (
          <NavLink key={path} to={"/teacher/" + path}>
            <Icon size={19} />
            {label}
            {path === "monitor" && <span className="dot" />}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <p>Built for better assessments.</p>
        <button className="sidebar-logout"
          onClick={() => {
            logout();
            nav("/");
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
