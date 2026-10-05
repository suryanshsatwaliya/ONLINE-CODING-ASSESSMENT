import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return <button type="button" className="theme-toggle" role="switch" aria-checked={theme === "dark"} aria-label="Dark theme" onClick={toggleTheme}>
    {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
    <span>{theme === "dark" ? "Dark" : "Light"}</span>
    <span className="theme-track" aria-hidden="true"><span /></span>
  </button>;
}
