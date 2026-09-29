import test from "node:test";
import assert from "node:assert/strict";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test";
process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters";
const { quizGrade, weightedScore, normalize } =
  await import("../src/services/grading.service.js");
const { studentQuestion } =
  await import("../src/services/assessment.service.js");
const { warningDecision } = await import("../src/services/proctor.service.js");
const { questionSchema, securitySchema } =
  await import("../src/validators/assessment.validator.js");
const { publicExecution } =
  await import("../src/services/codeRunner.service.js");
test("MCQ all-or-nothing, negatives, unanswered and normalized short answer", () => {
  const q = {
    marks: 10,
    negativeMarks: 2,
    type: "MULTIPLE",
    correctAnswer: [0, 2],
  };
  assert.equal(quizGrade(q, [2, 0]), 10);
  assert.equal(quizGrade(q, [0]), -2);
  assert.equal(quizGrade(q, []), 0);
  assert.equal(
    quizGrade({ ...q, type: "SHORT", correctAnswer: "Stack" }, " stack "),
    10,
  );
});
test("weighted hidden grading is deterministic", () => {
  assert.equal(
    weightedScore(
      [{ weight: 1 }, { weight: 3 }],
      [{ passed: true }, { passed: false }],
      40,
    ),
    10,
  );
  assert.equal(normalize("a\r\n"), "a");
  assert.notEqual(normalize(" a"), "a");
});
test("student projection cannot disclose hidden tests, answers or explanations", () => {
  const safe = studentQuestion({
    _id: "a",
    correctAnswer: [2],
    explanation: "secret",
    testCases: [
      { input: "PUBLIC", expectedOutput: "1", hidden: false },
      { input: "SECRET", expectedOutput: "secret-output", hidden: true },
    ],
  });
  assert.equal(JSON.stringify(safe).includes("SECRET"), false);
  assert.equal(safe.correctAnswer, undefined);
  assert.equal(safe.explanation, undefined);
  assert.equal(safe.testCases.length, 1);
});
test("hidden runner results suppress stdout, stderr, compilation output and inputs", () => {
  assert.deepEqual(
    publicExecution(
      {
        score: 2,
        results: [
          {
            passed: true,
            stdout: "secret",
            stderr: "secret",
            compileOutput: "secret",
          },
        ],
      },
      true,
    ),
    { score: 2, passed: 1, total: 1 },
  );
});
test("related browser transitions count once in the debounce window", () => {
  const s = securitySchema.parse({
    eventRules: {
      WINDOW_BLUR: "WARNING",
      TAB_HIDDEN: "WARNING",
      COPY_ATTEMPT: "WARNING",
    },
  });
  const now = new Date();
  assert.equal(
    warningDecision(
      s,
      "TAB_HIDDEN",
      { lastWarningGroup: "LEAVE", lastWarningAt: now },
      now,
    ).warn,
    false,
  );
  assert.equal(
    warningDecision(
      s,
      "COPY_ATTEMPT",
      { lastWarningGroup: "LEAVE", lastWarningAt: now },
      now,
    ).warn,
    true,
  );
  assert.equal(
    warningDecision({ ...s, blockCopy: false }, "COPY_ATTEMPT", {}, now).warn,
    false,
  );
});
test("invalid questions and absent hidden tests rejected", () => {
  assert.equal(
    questionSchema.safeParse({
      title: "Bad",
      type: "SINGLE",
      marks: 10,
      options: ["A", "B"],
      correctAnswer: [4],
    }).success,
    false,
  );
  assert.equal(
    questionSchema.safeParse({ title: "Bad", type: "CODING", marks: 10 })
      .success,
    false,
  );
});
