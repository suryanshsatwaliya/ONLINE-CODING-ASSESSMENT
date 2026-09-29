import { useEffect } from "react";
export default function Modal({ title, children, onClose }) {
  useEffect(() => {
    const f = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <div className="overlay">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="row between">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        {children}
      </section>
    </div>
  );
}
