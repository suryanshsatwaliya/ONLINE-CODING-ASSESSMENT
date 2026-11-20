import { useEffect, useState } from "react";

export const teacherCodeLines = [
  [{ text: "function", className: "code-keyword" }, { text: " solveChallenge", className: "code-function" }, { text: "() {" }],
  [{ text: "const", className: "code-constant" }, { text: " answer = " }, { text: "buildSolution", className: "code-function" }, { text: "();" }],
  [{ text: "return", className: "code-keyword" }, { text: " " }, { text: "validate", className: "code-function" }, { text: "(answer);" }],
  [{ text: "}" }],
];
const teacherCodeLength = teacherCodeLines.flat().reduce((total, segment) => total + segment.text.length, 0);

export function useCodeTyping(characterCount) {
  const [visibleCodeLetters, setVisibleCodeLetters] = useState(0);
  useEffect(() => {
    let timer;
    let letter = 0;
    const typeNextLetter = () => {
      letter += 1;
      setVisibleCodeLetters(letter);
      if (letter < characterCount) timer = window.setTimeout(typeNextLetter, 35);
      else timer = window.setTimeout(() => { letter = 0; setVisibleCodeLetters(0); timer = window.setTimeout(typeNextLetter, 350); }, 3000);
    };
    timer = window.setTimeout(typeNextLetter, 350);
    return () => window.clearTimeout(timer);
  }, [characterCount]);
  return visibleCodeLetters;
}

export function useTeacherCodeTyping() { return useCodeTyping(teacherCodeLength); }
