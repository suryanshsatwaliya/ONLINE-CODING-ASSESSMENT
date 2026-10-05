import { createContext, useContext, useLayoutEffect, useState } from "react";

const ThemeContext = createContext(null);
function savedTheme() {
  try { return (localStorage.getItem("portal-theme") ?? localStorage.getItem("exam-theme")) === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(savedTheme);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("portal-theme", theme); } catch { /* Keep the theme usable when storage is unavailable. */ }
  }, [theme]);
  useLayoutEffect(() => {
    const sync = (event) => {
      if (event.key === "portal-theme" || event.key === null) setTheme(savedTheme());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((old) => old === "dark" ? "light" : "dark") }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }
