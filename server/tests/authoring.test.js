import test from "node:test";
import assert from "node:assert/strict";
import { convertProblem, parseProblemNumber, plainText, importLeetcode } from "../src/services/leetcode.service.js";
import { assessmentSchema, questionSetSchema } from "../src/validators/assessment.validator.js";

const problem = {
  questionFrontendId: "67", title: "Example problem", titleSlug: "example-problem",
  content: '<p>Combine the inputs.</p><pre><strong>Input:</strong> a = "x", b = "y"\n<strong>Output:</strong> "xy"\n</pre><p>Constraints:</p><ul><li>length &lt; 10<sup>4</sup></li></ul>',
  difficulty: "Easy", isPaidOnly: false,
  exampleTestcases: '"x"\n"y"',
  metaData: JSON.stringify({ params: [{ name: "a", type: "string" }, { name: "b", type: "string" }], return: { type: "string" } }),
  topicTags: [{ name: "String" }],
};
test("problem number accepts friendly input and rejects arbitrary URLs", () => {
  for (const value of ["67", "LeetCode 67", "leetcode #67"]) assert.equal(parseProblemNumber(value), "67");
  for (const value of ["0", "-1", "https://example.com/67", "67 extra", "", {}]) assert.throws(() => parseProblemNumber(value));
});
test("public examples become JSON stdin and visible cases, never fabricated hidden cases", () => {
  const result = convertProblem(problem);
  assert.equal(result.question.testCases.length, 1);
  assert.equal(result.question.testCases[0].input, '"x"\n"y"');
  assert.equal(result.question.testCases[0].expectedOutput, '"xy"');
  assert.equal(result.question.testCases[0].hidden, false);
  assert.ok(result.question.constraints.includes("10^(4)"));
  assert.ok(result.warnings.some((warning) => warning.includes("private judging")));
  assert.ok(result.question.starterCode.python.includes("json.loads"));
  assert.ok(!result.question.description.includes("<p>"));
});
test("unsupported and misaligned examples are skipped with review warnings", () => {
  for (const patch of [{ exampleTestcases: '"x"' }, { content: problem.content.replace('"xy"', "any valid arrangement") }, { metaData: "broken" }]) {
    const result = convertProblem({ ...problem, ...patch });
    assert.deepEqual(result.question.testCases, []);
    assert.ok(result.warnings.length > 1);
  }
  assert.throws(() => convertProblem({ ...problem, isPaidOnly: true }));
  assert.equal(plainText('<script>alert(1)</script><p>A &amp; B</p>'), "A & B");
});
test("set validation preserves per-question errors and assessments cannot create bank questions", () => {
  const question = { title: "Question", question: "Choose A", type: "SINGLE", marks: 2, options: ["A", "B"], correctAnswer: [0] };
  const base = { title: "Quiz", type: "QUIZ", questions: [question, question] };
  assert.equal(questionSetSchema.parse(base).questions.length, 2);
  const invalid = questionSetSchema.safeParse({ ...base, questions: [question, { ...question, correctAnswer: [9] }] });
  assert.equal(invalid.success, false);
  assert.deepEqual(invalid.error.issues[0].path.slice(0, 2), ["questions", 1]);
  assert.equal(questionSetSchema.safeParse({ ...base, questions: Array(101).fill(question) }).success, false);
  assert.equal(assessmentSchema.safeParse({ title: "Test", type: "QUIZ", duration: 30, newQuestions: [question] }).success, false);
  assert.equal(questionSetSchema.safeParse({ ...base, type: "CODING" }).success, false);
});
test("example explanations survive import and non-runnable examples are preserved without fabricated tests", () => {
  const withExplanation = { ...problem, content: problem.content.replace('"xy"\n</pre>', '"xy"\nExplanation: Join both inputs.\n</pre>') };
  assert.equal(convertProblem(withExplanation).question.examples[0].explanation, "Join both inputs.");
  const raw = convertProblem({ ...withExplanation, exampleTestcases: "" });
  assert.equal(raw.question.examples[0].explanation, "Join both inputs.");
  assert.equal(raw.question.examples[0].input, 'a = "x", b = "y"');
  assert.equal(raw.question.testCases.length, 0);
  assert.equal(questionSetSchema.safeParse({ title: "Coding", type: "CODING", questions: [{ ...raw.question, marks: 10 }] }).success, true);
});
test("import adapter resolves the public number, keeps a fixed host and reports provider failures", async () => {
  const original = global.fetch;
  const calls = [];
  let mode = "success";
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (mode === "failure") throw new Error("Network down");
    return { ok: true, json: async () => url.endsWith("/all/")
      ? { stat_status_pairs: [{ stat: { frontend_question_id: 67, question__title_slug: "example-problem" }, paid_only: false }] }
      : { data: { question: mode === "wrong" ? { ...problem, questionFrontendId: "68" } : problem } } };
  };
  try {
    const imported = await importLeetcode("LeetCode 67");
    assert.equal(imported.question.title, "67. Example problem");
    assert.equal(calls.length, 2);
    assert.ok(calls.every((call) => call.url.startsWith("https://leetcode.com/")));
    assert.equal(JSON.parse(calls[1].options.body).variables.titleSlug, "example-problem");
    mode = "wrong";
    await assert.rejects(() => importLeetcode("67"), /different problem/);
    mode = "failure";
    await assert.rejects(() => importLeetcode("67"), /unavailable or blocked/);
  } finally { global.fetch = original; }
});
