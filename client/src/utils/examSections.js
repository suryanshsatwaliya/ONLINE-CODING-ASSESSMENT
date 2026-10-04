// Keep original indexes so randomized questions still save under the right ID.
export function examSections(questions) {
  return [
    { id: "quiz", label: "Quiz", indexes: questions.flatMap((q, i) => q.type !== "CODING" ? [i] : []) },
    { id: "coding", label: "Coding", indexes: questions.flatMap((q, i) => q.type === "CODING" ? [i] : []) },
  ].filter((section) => section.indexes.length);
}
