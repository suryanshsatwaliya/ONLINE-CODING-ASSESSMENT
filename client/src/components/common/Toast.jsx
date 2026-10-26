import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
const Context = createContext(null);
export const useToast = () => useContext(Context);
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timeout = useRef(null);
  const exitTimeout = useRef(null);
  const notify = (message, options = {}) => {
    clearTimeout(timeout.current);
    clearTimeout(exitTimeout.current);
    setToast({ message, success: Boolean(options.success), leaving: false });
    timeout.current = setTimeout(() => {
      setToast((current) => current ? { ...current, leaving: true } : null);
      exitTimeout.current = setTimeout(() => setToast(null), 250);
    }, 2250);
  };
  const dismiss = () => {
    clearTimeout(timeout.current);
    clearTimeout(exitTimeout.current);
    setToast((current) => current ? { ...current, leaving: true } : null);
    exitTimeout.current = setTimeout(() => setToast(null), 250);
  };
  useEffect(() => () => {
    clearTimeout(timeout.current);
    clearTimeout(exitTimeout.current);
  }, []);
  return (
    <Context.Provider value={notify}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`toast ${toast.success ? "toast-success" : ""} ${toast.leaving ? "toast-leaving" : ""}`}
          onClick={dismiss}
        >
          {toast.success ? (
            <>
              <span className="toast-success-icon"><Check size={21} strokeWidth={3} /></span>
              <span className="toast-success-copy">
                <small>SUCCESS</small>
                <strong>{toast.message}</strong>
              </span>
            </>
          ) : <span>{toast.message}</span>}
        </div>
      )}
    </Context.Provider>
  );
}
