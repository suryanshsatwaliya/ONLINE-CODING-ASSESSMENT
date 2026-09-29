import { createContext, useContext, useState } from "react";
const Context = createContext(null);
export const useToast = () => useContext(Context);
export function ToastProvider({ children }) {
  const [message, set] = useState("");
  const notify = (message) => {
    set(message);
    setTimeout(() => set(""), 6000);
  };
  return (
    <Context.Provider value={notify}>
      {children}
      {message && (
        <div role="status" className="toast" onClick={() => set("")}>
          {message}
        </div>
      )}
    </Context.Provider>
  );
}
