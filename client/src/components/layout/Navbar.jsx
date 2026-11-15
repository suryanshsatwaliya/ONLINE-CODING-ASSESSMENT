import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import ThemeToggle from "../common/ThemeToggle";
export default function Navbar({ actions }) {
  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        <span className="brand-icon">
          <ShieldCheck size={22} />
        </span>
        <span className="brand-copy"><strong>AStarCoders</strong><small>Where Skills Reach the Stars.</small></span>
      </Link>
      {actions ?? (
        <div className="navbar-actions"><ThemeToggle /></div>
      )}
    </nav>
  );
}
