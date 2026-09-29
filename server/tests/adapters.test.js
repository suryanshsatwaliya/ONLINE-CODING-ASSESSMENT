import test from "node:test";
import assert from "node:assert/strict";
process.env.MONGODB_URI = "mongodb://127.0.0.1/test";
process.env.JWT_SECRET = "adapter-test-secret-at-least-32-characters";
const { env } = await import("../src/config/env.js");
const { execute, publicExecution } =
  await import("../src/services/codeRunner.service.js");
const { reviewCode } = await import("../src/services/aiGrading.service.js");
test("Judge0 adapter sends sandbox limits and grades returned output", async () => {
  const original = global.fetch;
  const calls = [];
  env.CODE_RUNNER_URL = "https://runner.invalid";
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      json: async () =>
        opts.method === "POST"
          ? { token: "job" }
          : {
              status: { id: 3, description: "Accepted" },
              stdout: Buffer.from("5\n").toString("base64"),
              time: "0.01",
              memory: 1000,
            },
    };
  };
  try {
    const q = {
      supportedLanguages: ["python"],
      timeLimit: 2,
      memoryLimit: 128000,
      marks: 40,
      testCases: [
        { input: "2 3", expectedOutput: "5", hidden: true, weight: 1 },
        { input: "4 5", expectedOutput: "9", hidden: false, weight: 1 },
      ],
    };
    const result = await execute(q, "print(5)", "python", true);
    assert.equal(result.score, 40);
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.enable_network, false);
    assert.equal(body.cpu_time_limit, 2);
    assert.equal(body.memory_limit, 128000);
    assert.equal(body.max_file_size, 32);
    assert.equal(calls.length, 2);
    assert.equal(publicExecution(result, true).stdout, undefined);
  } finally {
    global.fetch = original;
    env.CODE_RUNNER_URL = "";
  }
});
test("AI adapter validates JSON and rejects provider output outside rubric bounds", async () => {
  const original = global.fetch;
  env.AI_API_URL = "https://ai.invalid/chat/completions";
  env.AI_API_KEY = "test";
  env.AI_MODEL = "test-model";
  let content = JSON.stringify({
    codeQuality: 8,
    efficiency: 7,
    readability: 9,
    feedback: "Clear code",
  });
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
  try {
    const r = await reviewCode(
      { description: "Sum" },
      "print(5)",
      "python",
      "Quality",
    );
    assert.equal(r.codeQuality, 8);
    content = JSON.stringify({
      codeQuality: 99,
      efficiency: 7,
      readability: 9,
      feedback: "Invalid",
    });
    await assert.rejects(
      () => reviewCode({ description: "Sum" }, "print(5)", "python", "Quality"),
      /invalid structured/,
    );
  } finally {
    global.fetch = original;
    env.AI_API_URL = "";
    env.AI_API_KEY = "";
    env.AI_MODEL = "";
  }
});
