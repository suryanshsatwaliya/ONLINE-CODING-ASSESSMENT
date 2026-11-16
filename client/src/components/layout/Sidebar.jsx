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
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Menu, X } from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth(),
    nav = useNavigate();
  return (
    <aside className={`sidebar${isOpen ? " is-open" : ""}`}>
      {isOpen && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setIsOpen(false)} />}
      <div className="brand">
        <span className="brand-icon">
          <ShieldCheck />
        </span>
        AStarCoders
        <button
          className="sidebar-menu-toggle"
          type="button"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isOpen}
          aria-controls="teacher-navigation"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <nav className="sidebar-nav-panel" id="teacher-navigation">
        {items.map(([path, label, Icon]) => (
          <NavLink key={path} to={"/teacher/" + path} onClick={() => setIsOpen(false)}>
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
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
