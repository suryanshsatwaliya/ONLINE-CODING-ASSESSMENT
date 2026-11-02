import { useEffect, useState } from "react";
import { api, errorMessage } from "../../services/api";
import Input from "../common/Input";

const BLOCK_TAGS = new Set(["P", "DIV", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "PRE"]);

function splitParameterTypes(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "<") depth++;
    else if (value[index] === ">") depth = Math.max(0, depth - 1);
    else if (value[index] === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function readMathNode(node) {
  const tag = node.tagName?.toLowerCase();
  const children = [...node.childNodes].map(readClipboardNode).join("");
  const baseTag = tag?.replace(/^mjx-/, "");
  if (["msup", "msub", "mfrac"].includes(baseTag)) {
    const parts = [...node.childNodes].map(readClipboardNode);
    if (baseTag === "msup") return `${parts[0] || ""}^${parts[1] || ""}`;
    if (baseTag === "msub") return `${parts[0] || ""}_${parts[1] || ""}`;
    return `(${parts[0] || ""})/(${parts[1] || ""})`;
  }
  if (["math", "mrow", "semantics", "mstyle"].includes(tag)) return children;
  if (["annotation", "annotation-xml"].includes(tag)) return "";
  if (["mi", "mn", "mo", "mtext"].includes(tag)) return node.textContent || "";
  return children;
}

function readClipboardNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  if (node.getAttribute("aria-hidden") === "true") return "";
  if (
    tag === "mjx-assistive-mml" ||
    node.classList?.contains("katex-html") ||
    node.classList?.contains("katex-mathml")
  ) return "";
  if (["script", "style", "annotation", "annotation-xml"].includes(tag)) return "";
  if (tag === "math" || tag.startsWith("mjx-")) return readMathNode(node);
  if (node.classList?.contains("katex")) {
    const math = node.querySelector(".katex-mathml math");
    if (math) return readMathNode(math);
  }
  if (tag === "br") return "\n";
  if (tag === "sup") return `^${[...node.childNodes].map(readClipboardNode).join("")}`;
  if (tag === "sub") return `_${[...node.childNodes].map(readClipboardNode).join("")}`;
  const content = [...node.childNodes].map(readClipboardNode).join("");
  if (tag === "li") return `• ${content.trim()}\n`;
  if (BLOCK_TAGS.has(node.tagName)) return `\n${content.trim()}\n`;
  return content;
}

function normalizePastedText(event) {
  const clipboard = event.clipboardData;
  const html = clipboard?.getData("text/html");
  let pasted = clipboard?.getData("text/plain") || "";

  if (html && typeof DOMParser !== "undefined") {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const richText = [...parsed.body.childNodes].map(readClipboardNode).join("");
    if (richText.trim()) pasted = richText;
  }

  pasted = pasted
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200f\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n[\t ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Some math renderers put each glyph on its own line in text/plain.
  // Rejoin those fragments while keeping paragraph and bullet boundaries.
  const lines = pasted.split("\n");
  const fixed = [];
  let fragments = [];
  const flushFragments = () => {
    if (!fragments.length) return;
    const hasGlyphBreaks = fragments.filter((line) => [...line.trim()].length === 1).length >= 3;
    if (hasGlyphBreaks) {
      let line = "";
      for (const token of fragments.map((part) => part.trim()).filter(Boolean)) {
        if (/^[≤≥<>!=]$/.test(token)) line = `${line.trimEnd()} ${token} `;
        else if (/^[A-Za-z]$/.test(token) && /[A-Za-z]$/.test(line)) line += token;
        else if (/^\d$/.test(token) && /\d$/.test(line)) line += `^${token}`;
        else line += `${line && !/[\s]$/.test(line) ? " " : ""}${token}`;
      }
      const compact = line.replace(/\s+/g, "");
      // Some rendered equations are copied twice: once as positioned glyphs,
      // then again as an accessible text string. Drop an adjacent duplicate.
      let deduplicated = line.trim();
      for (let split = Math.ceil(compact.length / 2); split >= 3; split--) {
        const left = compact.slice(0, split);
        const right = compact.slice(split);
        if (left === right && /[≤≥<>^_=]/.test(left)) {
          deduplicated = left.replace(/([≤≥<>])/g, " $1 ").replace(/\s+/g, " ").trim();
          break;
        }
      }
      fixed.push(deduplicated);
    } else fixed.push(...fragments);
    fragments = [];
  };
  for (const line of lines) {
    if (!line.trim()) {
      flushFragments();
      if (fixed.length && fixed.at(-1) !== "") fixed.push("");
      continue;
    }
    if (/^\s*[•●▪*-]\s*/.test(line)) {
      flushFragments();
      fragments.push(line.replace(/^\s*[•●▪*-]\s*/, ""));
      flushFragments();
      continue;
    }
    fragments.push(line);
  }
  flushFragments();
  return fixed.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export default function CodingProblemBuilder({ value: q, onChange }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  const handleFormattedPaste = (event, key) => {
    const pasted = normalizePastedText(event);
    if (!pasted) return;
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const next = `${target.value.slice(0, start)}${pasted}${target.value.slice(end)}`;
    set(key, next);
    requestAnimationFrame(() => {
      const cursor = start + pasted.length;
      target.setSelectionRange(cursor, cursor);
    });
  };
  const languages = ["python", "javascript", "cpp", "java", "c"];
  const labels = { python: "Python", javascript: "JavaScript", cpp: "C++", java: "Java", c: "C" };
  const methodStyle = q.executionConfig?.mode !== "STDIO";
  const executionConfig = q.executionConfig || { mode: "LEETCODE", methodName: "", params: [], returnType: "" };
  const parameterTypes = (executionConfig.params || []).map((param) => param.type).join(", ");
  const displayedTestCases = methodStyle ? q.testCases : q.testCases.slice(0, 1);
  const [activeLanguage, setActiveLanguage] = useState(() =>
    q.supportedLanguages.includes("python") ? "python" : q.supportedLanguages[0] || "python",
  );
  const [restoringCases, setRestoringCases] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  useEffect(() => {
    if (q.externalReference)
      setActiveLanguage(q.supportedLanguages.includes("python") ? "python" : q.supportedLanguages[0] || "python");
  }, [q.externalReference]);
  return (
    <>
      <div className="coding-statement-fields">
        {["description", "constraints", "inputFormat", "outputFormat"].map(
          (k) => (
            <label className="field" key={k}>
              {{ description: "Problem statement", constraints: "Constraints (optional)", inputFormat: "Input format", outputFormat: "Output format" }[k]}
              <textarea
                rows={k === "description" ? 6 : 3}
                required={k === "description"}
                value={q[k]}
                onPaste={(event) => handleFormattedPaste(event, k)}
                onChange={(e) => set(k, e.target.value)}
              />
            </label>
          ),
        )}
      </div>
      <label className="field coding-execution-mode">
        Code submission style
        <select
          value={methodStyle ? "LEETCODE" : "STDIO"}
          disabled={restoringCases}
          onChange={async (event) => {
            if (event.target.value === "LEETCODE") {
              const compatibleLanguages = q.supportedLanguages.filter((language) => language !== "c");
              const { methodTestCases, ...methodConfig } = executionConfig;
              let restoredTestCases = methodTestCases;
              if (!restoredTestCases?.length && executionConfig.mode === "STDIO" && q.externalReference) {
                setRestoringCases(true);
                setRestoreError("");
                try {
                  const { data } = await api.post("/questions/leetcode/import", { reference: q.externalReference });
                  restoredTestCases = data.question?.testCases?.map((testCase) => ({
                    ...testCase,
                    hidden: false,
                    weight: testCase.weight || 1,
                  }));
                  if (!restoredTestCases?.length) throw new Error("LeetCode did not return any public sample cases.");
                } catch (error) {
                  setRestoreError(`Could not restore the LeetCode sample cases: ${errorMessage(error)}`);
                  setRestoringCases(false);
                  return;
                }
                setRestoringCases(false);
              }
              onChange({
                ...q,
                testCases: restoredTestCases?.length ? restoredTestCases : q.testCases,
                supportedLanguages: compatibleLanguages.length ? compatibleLanguages : ["cpp"],
                executionConfig: { ...methodConfig, mode: "LEETCODE", methodName: methodConfig.methodName || "", params: methodConfig.params || [], returnType: methodConfig.returnType || "" },
              });
              if (activeLanguage === "c") setActiveLanguage(compatibleLanguages[0] || "cpp");
            } else {
              const testCases = q.testCases.length
                ? [{ ...q.testCases[0], hidden: false }]
                : [{ input: "", expectedOutput: "", hidden: false, weight: 1 }];
              onChange({
                ...q,
                testCases,
                executionConfig: { ...executionConfig, mode: "STDIO", methodTestCases: q.testCases },
              });
            }
          }}
        >
          <option value="STDIO">Complete program (stdin / stdout)</option>
          <option value="LEETCODE">LeetCode method (class Solution)</option>
        </select>
        <small>Method style is the default and wraps a class Solution method for Judge0. Complete-program mode grades only the first visible sample case; hidden cases are ignored.</small>
        {restoringCases && <small role="status">Restoring public LeetCode sample cases…</small>}
        {restoreError && <small className="error" role="alert">{restoreError}</small>}
      </label>
      {methodStyle && <div className="coding-execution-config">
        <label className="field">
          Solution method name (optional)
          <input
            value={executionConfig.methodName || ""}
            placeholder="e.g. twoSum"
            maxLength={100}
            onChange={(event) => set("executionConfig", { ...executionConfig, methodName: event.target.value })}
          />
        </label>
        <label className="field">
          Parameter types in method order (optional)
          <input
            value={parameterTypes}
            placeholder="e.g. integer[], integer"
            onChange={(event) => set("executionConfig", {
              ...executionConfig,
              params: splitParameterTypes(event.target.value).map((type, index) => ({ name: `arg${index + 1}`, type })).filter((param) => param.type),
            })}
          />
          <small>Leave blank to infer types from the method signature. Separate parameters with commas; nested types are supported, for example <code>integer, pair&lt;integer,integer&gt;[]</code> for <code>int n, vector&lt;pair&lt;int,int&gt;&gt;&amp; vehicles</code>.</small>
        </label>
        <label className="field">
          Return type
          <input
            value={executionConfig.returnType || ""}
            placeholder="e.g. integer[] or void"
            maxLength={100}
            onChange={(event) => set("executionConfig", { ...executionConfig, returnType: event.target.value })}
          />
          <small>Use <code>void</code> when the method updates its input argument in place.</small>
        </label>
      </div>}
      <details className="question-extra">
      <summary>Languages, starter code & execution settings</summary>
      <div className="form-grid">
        <Input
          label="Time limit (seconds)"
          type="number"
          min=".1"
          max="5"
          step=".1"
          value={q.timeLimit}
          onChange={(e) => set("timeLimit", +e.target.value)}
        />
        <Input
          label="Memory limit (KB)"
          type="number"
          value={q.memoryLimit}
          onChange={(e) => set("memoryLimit", +e.target.value)}
        />
        <Input
          label="Quality marks (optional AI rubric)"
          type="number"
          value={q.qualityMarks || ""}
          onChange={(e) => set("qualityMarks", +e.target.value)}
        />
        <Input
          label="Efficiency marks (optional AI rubric)"
          type="number"
          value={q.efficiencyMarks || ""}
          onChange={(e) => set("efficiencyMarks", +e.target.value)}
        />
      </div>
      <h3>Languages & starter code</h3>
      <div className="coding-language-editor">
        <div className="coding-language-tabs" aria-label="Starter code language">
          {languages.map((language) => {
            const enabled = q.supportedLanguages.includes(language);
            return (
              <div className={`coding-language-option ${activeLanguage === language ? "active" : ""}`} key={language}>
                <button
                  type="button"
                  className="coding-language-tab"
                  aria-pressed={activeLanguage === language}
                  onClick={() => setActiveLanguage(language)}
                >
                  {labels[language]}
                </button>
                <label className="coding-language-toggle" title={`${enabled ? "Disable" : "Enable"} ${labels[language]}`}>
                  <input
                    type="checkbox"
                    aria-label={`${enabled ? "Disable" : "Enable"} ${labels[language]}`}
                    checked={enabled}
                    disabled={methodStyle && language === "c"}
                    onChange={(e) => set(
                      "supportedLanguages",
                      e.target.checked
                        ? [...q.supportedLanguages, language]
                        : q.supportedLanguages.filter((item) => item !== language),
                    )}
                  />
                  <span aria-hidden="true" />
                </label>
              </div>
            );
          })}
        </div>
        <section className="coding-language-panel" aria-label={`${labels[activeLanguage]} starter code`}>
          <div className="coding-language-panel-heading">
            <strong>{labels[activeLanguage]} starter code</strong>
          </div>
          <textarea
            className="code-input"
            aria-label={`${labels[activeLanguage]} starter code`}
            value={q.starterCode[activeLanguage] || ""}
            onChange={(e) => set("starterCode", { ...q.starterCode, [activeLanguage]: e.target.value })}
          />
        </section>
      </div>
      </details>
      <h3>Examples</h3>
      {q.examples.map((t, i) => (
        <div className="form-grid example-builder-card" key={i}>
          <label className="field">Example input
          <textarea
            rows="3"
            value={t.input}
            onChange={(e) =>
              set(
                "examples",
                q.examples.map((x, j) =>
                  i === j ? { ...x, input: e.target.value } : x,
                ),
              )
            }
          />
          </label>
          <label className="field">Example output
          <textarea
            rows="3"
            value={t.output}
            onChange={(e) =>
              set(
                "examples",
                q.examples.map((x, j) =>
                  i === j ? { ...x, output: e.target.value } : x,
                ),
              )
            }
          />
          </label>
          <label className="field">Explanation (optional)
            <textarea rows={2} value={t.explanation || ""} onChange={(e) => set("examples", q.examples.map((x, j) => i === j ? { ...x, explanation: e.target.value } : x))} />
          </label>
          <button
            type="button"
            onClick={() =>
              set(
                "examples",
                q.examples.filter((_, j) => j !== i),
              )
            }
          >
            Remove example
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          set("examples", [...q.examples, { input: "", output: "", explanation: "" }])
        }
      >
        + Add example
      </button>
      <h3>Test cases</h3>
      <p className="muted">
        {methodStyle
          ? "Enter one JSON argument per line, in method parameter order. For int n and vector<pair<int,int>>& vehicles, enter 3 on line 1 and [[100,160],[200,350],[1300,100]] on line 2. Do not enter stdin-only count/value lines. Expected output should be JSON (for example, [30,50,110]). Add at least one hidden grading case before using this problem in an assessment."
          : "Enter the complete program's stdin in each visible sample case and its expected stdout. Students use Run & grade; only the first visible sample case determines marks. Hidden cases are ignored."}
      </p>
      {displayedTestCases.map((t, i) => (
        <div className="test-builder" key={i}>
          <div className="form-grid">
            <label className="field">
              Input
              <textarea
                value={t.input}
                onChange={(e) =>
                  set(
                    "testCases",
                    q.testCases.map((x, j) =>
                      i === j ? { ...x, input: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label className="field">
              Expected output
              <textarea
                value={t.expectedOutput}
                onChange={(e) =>
                  set(
                    "testCases",
                    q.testCases.map((x, j) =>
                      i === j ? { ...x, expectedOutput: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
          </div>
          <div className="row">
            {methodStyle && <label className="check">
              <input
                type="checkbox"
                checked={t.hidden}
                onChange={(e) =>
                  set(
                    "testCases",
                    q.testCases.map((x, j) =>
                      i === j ? { ...x, hidden: e.target.checked } : x,
                    ),
                  )
                }
              />
              Hidden
            </label>}
            {methodStyle && <Input
              label="Weight"
              type="number"
              min="1"
              value={t.weight}
              onChange={(e) =>
                set(
                  "testCases",
                  q.testCases.map((x, j) =>
                    i === j ? { ...x, weight: +e.target.value } : x,
                  ),
                )
              }
            />}
            {methodStyle && <button
              type="button"
              onClick={() =>
                set(
                  "testCases",
                  q.testCases.filter((_, j) => i !== j),
                )
              }
            >
              Remove
            </button>}
          </div>
        </div>
      ))}
      {methodStyle && <button
        type="button"
        onClick={() =>
          set("testCases", [
            ...q.testCases,
            { input: "", expectedOutput: "", hidden: methodStyle, weight: 1 },
          ])
        }
      >
        + Add test case
      </button>}
    </>
  );
}
