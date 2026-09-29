import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
export default function CodeEditor({ language, value, onChange }) {
  return (
    <Editor
      height="420px"
      language={language === "cpp" || language === "c" ? "cpp" : language}
      theme="vs-dark"
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
