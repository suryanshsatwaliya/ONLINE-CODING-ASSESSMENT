import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
export default function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        <span className="brand-icon">
          <ShieldCheck size={22} />
        </span>
        Assess<span className="muted"> / Portal</span>
      </Link>
      <span className="eyebrow">LEARN. ASSESS. GROW.</span>
    </nav>
  );
}
