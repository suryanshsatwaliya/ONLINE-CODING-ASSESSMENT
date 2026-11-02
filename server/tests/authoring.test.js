import test from "node:test";
import assert from "node:assert/strict";
import { convertProblem, parseProblemSlug, plainText, importLeetcodeProblem } from "../src/services/leetcodeImport.service.js";
import { assessmentSchema, questionSetSchema } from "../src/validators/assessment.validator.js";

const problem = {
  questionFrontendId: "67", title: "Example problem", titleSlug: "example-problem",
  content: '<p>Combine the inputs.</p><pre><strong>Input:</strong> a = "x", b = "y"\n<strong>Output:</strong> "xy"\n</pre><p>Constraints:</p><ul><li>length &lt; 10<sup>4</sup></li></ul>',
  difficulty: "Easy", isPaidOnly: false,
  exampleTestcases: '"x"\n"y"',
  metaData: JSON.stringify({ params: [{ name: "a", type: "string" }, { name: "b", type: "string" }], return: { type: "string" } }),
  topicTags: [{ name: "String" }],
};
test("LeetCode importer accepts problem URLs and slugs, but not ambiguous numbers", () => {
  for (const value of ["two-sum", "https://leetcode.com/problems/two-sum/", "leetcode.com/problems/two-sum/description/"]) assert.equal(parseProblemSlug(value), "two-sum");
  for (const value of ["67", "https://example.com/problems/two-sum", "two sum", "", {}]) assert.throws(() => parseProblemSlug(value));
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
test("import adapter fetches a problem directly by slug and reports provider failures", async () => {
  const original = global.fetch;
  const calls = [];
  let mode = "success";
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (mode === "failure") throw new Error("Network down");
    return { ok: true, json: async () => ({ data: { question: problem } }) };
  };
  try {
    const imported = await importLeetcodeProblem("https://leetcode.com/problems/example-problem/");
    assert.equal(imported.question.title, "67. Example problem");
    assert.equal(calls.length, 1);
    assert.ok(calls.every((call) => call.url.startsWith("https://leetcode.com/")));
    assert.equal(JSON.parse(calls[0].options.body).variables.titleSlug, "example-problem");
    mode = "failure";
    await assert.rejects(() => importLeetcodeProblem("example-problem"), /could not be reached/);
  } finally { global.fetch = original; }
});
test("numeric LeetCode references resolve the exact frontend ID before fetching details", async () => {
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    const payload = JSON.parse(options.body);
    if (payload.operationName === "problemsetQuestionListV2") {
      return { ok: true, json: async () => ({ data: { problemsetQuestionListV2: { questions: [
        { questionFrontendId: "10", titleSlug: "regular-expression-matching", title: "Regular Expression Matching", paidOnly: false },
        { questionFrontendId: "1", titleSlug: "two-sum", title: "Two Sum", paidOnly: false },
      ] } } }) };
    }
    return { ok: true, json: async () => ({ data: { question: { ...problem, questionFrontendId: "1", title: "Two Sum", titleSlug: "two-sum" } } }) };
  };
  try {
    const imported = await importLeetcodeProblem("1");
    assert.equal(imported.question.externalReference, "https://leetcode.com/problems/two-sum/");
    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[0].options.body).variables.searchKeyword, "1");
    assert.equal(JSON.parse(calls[1].options.body).variables.titleSlug, "two-sum");
  } finally { global.fetch = original; }
});
test("numeric LeetCode lookup falls back to catalog pages when keyword search omits the ID", async () => {
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push(JSON.parse(options.body));
    const payload = JSON.parse(options.body);
    if (payload.operationName === "problemsetQuestionListV2") {
      const isSearch = Boolean(payload.variables.searchKeyword);
      return { ok: true, json: async () => ({ data: { problemsetQuestionListV2: {
        questions: isSearch
          ? [{ questionFrontendId: "10", titleSlug: "regular-expression-matching", title: "Regular Expression Matching", paidOnly: false }]
          : [{ questionFrontendId: "67", titleSlug: "add-binary", title: "Add Binary", paidOnly: false }],
        totalLength: isSearch ? 1 : 1,
        hasMore: false,
      } } }) };
    }
    return { ok: true, json: async () => ({ data: { question: { ...problem, questionFrontendId: "67", title: "Add Binary", titleSlug: "add-binary" } } }) };
  };
  try {
    const imported = await importLeetcodeProblem("67");
    assert.equal(imported.question.title, "67. Add Binary");
    assert.equal(calls.length, 3);
    assert.equal(calls[0].variables.searchKeyword, "67");
    assert.equal(calls[1].variables.searchKeyword, null);
  } finally { global.fetch = original; }
});
