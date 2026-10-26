import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { useTheme } from "../../context/ThemeContext";
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
export default function CodeEditor({ language, value, onChange, theme, height = "420px" }) {
  const { theme: portalTheme } = useTheme();
  return (
    <Editor
      height={height}
      language={language === "cpp" || language === "c" ? "cpp" : language}
      theme={(theme ?? portalTheme) === "dark" ? "vs-dark" : "light"}
      value={value}
      onChange={(v) => onChange(v || "")}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        contextmenu: true,
        quickSuggestions: false,
      }}
    />
  );
}
