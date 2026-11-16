import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
import { X } from "lucide-react";
import { useEffect } from "react";
const items = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["students", "Students", Users],
  ["assessments", "Assessments", ClipboardList],
  ["questions", "Question Bank", Library],
  ["monitor", "Live Monitor", Radio],
  ["submissions", "Submissions & results", FileCode],
  ["settings", "Settings", Settings],
];
export default function Sidebar({ isOpen, onClose, mobileOnly = false }) {
  const { logout } = useAuth(),
    nav = useNavigate(),
    location = useLocation();
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);
  return (
    <>
      {isOpen && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar${isOpen ? " is-open" : ""}${mobileOnly ? " mobile-nav-only" : ""}`}>
        <div className="brand">
          <span className="brand-icon">
            <ShieldCheck />
          </span>
          AStarCoders
          <button
            className="sidebar-close-button"
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav-panel" id="teacher-navigation">
          {items.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={"/teacher/" + path}
              onClick={onClose}
              end={path === "dashboard"}
              className={({ isActive }) => isActive || (path === "submissions" && location.pathname === "/teacher/results") ? "active" : undefined}
            >
              <Icon size={19} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-logout"
            onClick={() => {
              logout();
              nav("/");
              onClose();
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
