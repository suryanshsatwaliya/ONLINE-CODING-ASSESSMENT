import { useEffect } from "react";
import { X } from "lucide-react";
export default function Modal({ title, children, onClose, className = "" }) {
  useEffect(() => {
    const f = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [onClose]);
  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const documentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = documentOverflow;
    };
  }, []);
  return (
    <div className="overlay">
      <section
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="row between">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
      </section>
    </div>
  );
}
