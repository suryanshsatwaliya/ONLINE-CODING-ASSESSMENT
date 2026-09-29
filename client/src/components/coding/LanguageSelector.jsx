import { languageNames } from "../../utils/constants";
export default function LanguageSelector({ languages, value, onChange }) {
  return (
    <select
      aria-label="Programming language"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {languages.map((l) => (
        <option key={l} value={l}>
          {languageNames[l]}
        </option>
      ))}
    </select>
  );
}
