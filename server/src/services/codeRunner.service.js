import { env } from "../config/env.js";
import ApiError from "../utils/ApiError.js";
import { normalize, weightedScore } from "./grading.service.js";
import { prepareLeetcodeCode } from "./leetcodeHarness.service.js";
export const languages = JSON.parse(
  env.CODE_RUNNER_LANGUAGES ||
    '{"c":50,"cpp":54,"java":62,"python":71,"javascript":63}',
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  return value;
}
function outputsMatch(actual, expected) {
  try {
    return JSON.stringify(canonicalJson(JSON.parse(actual))) ===
      JSON.stringify(canonicalJson(JSON.parse(expected)));
  } catch {
    return normalize(actual) === normalize(expected);
  }
}
async function request(path, body, deadline = Date.now() + 15000) {
  const headers = { "Content-Type": "application/json" };
  if (env.CODE_RUNNER_API_KEY)
    headers[env.CODE_RUNNER_AUTH_HEADER || "X-Auth-Token"] =
      env.CODE_RUNNER_API_KEY;
  if (env.CODE_RUNNER_HOST) headers["X-RapidAPI-Host"] = env.CODE_RUNNER_HOST;
  const r = await fetch(env.CODE_RUNNER_URL.replace(/\/$/, "") + path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(
      Math.max(1, Math.min(15000, deadline - Date.now())),
    ),
  });
  if (!r.ok) throw new ApiError(502, "Code runner rejected the request");
  return r.json();
}
export async function execute(q, code, language, hidden = false, { includeHidden = false, sampleOnly = false } = {}) {
  if (!env.CODE_RUNNER_URL)
    throw new ApiError(
      503,
      "Code execution is not configured. Ask your teacher.",
    );
  if (!languages[language] || !q.supportedLanguages.includes(language))
    throw new ApiError(422, "Unsupported language");
  const sourceCode = prepareLeetcodeCode(q, code, language);
  const completeProgram = q.executionConfig?.mode === "STDIO";
  const tests = includeHidden
    ? q.testCases.filter((t) => Boolean(t.hidden))
    : sampleOnly
      ? q.testCases.filter((t) => !t.hidden).slice(0, 1)
      : completeProgram
        ? q.testCases.filter((t) => !t.hidden).slice(0, 1)
        : q.testCases.filter((t) => Boolean(t.hidden) === hidden),
    results = [];
  for (const t of tests) {
    const deadline = Date.now() + 55000;
    const body = {
      source_code: Buffer.from(sourceCode).toString("base64"),
      stdin: Buffer.from(t.input).toString("base64"),
      language_id: languages[language],
      cpu_time_limit: q.timeLimit,
      wall_time_limit: Math.min(15, q.timeLimit * 3),
      memory_limit: q.memoryLimit,
      max_file_size: 32,
      enable_network: false,
    };
    const { token } = await request(
      "/submissions?base64_encoded=true&wait=false",
      body,
      deadline,
    );
    if (!token) throw new ApiError(502, "Runner did not return a job token");
    let r;
    for (let i = 0; i < 45 && Date.now() < deadline; i++) {
      await sleep(700);
      r = await request(
        "/submissions/" + encodeURIComponent(token) + "?base64_encoded=true",
        undefined,
        deadline,
      );
      if (r.status?.id > 2) break;
    }
    if (!r || r.status?.id <= 2) throw new ApiError(504, "Runner timed out");
    const decode = (x) => (x ? Buffer.from(x, "base64").toString("utf8") : "");
    const stdout = decode(r.stdout),
      passed =
        r.status.id === 3 && outputsMatch(stdout, t.expectedOutput);
    results.push({
      passed,
      status: passed
        ? "Accepted"
        : r.status.id === 3
          ? "Wrong Answer"
          : r.status.description,
      stdout: stdout.slice(0, 16000),
      stderr: decode(r.stderr).slice(0, 16000),
      compileOutput: decode(r.compile_output).slice(0, 16000),
      time: r.time,
      memory: r.memory,
    });
  }
  return { results, score: weightedScore(tests, results, q.marks) };
}
export const publicExecution = (execution, hidden, revealSampleOutput = false) =>
  hidden && revealSampleOutput
    ? {
        results: execution.results.slice(0, 1).map((result) => ({
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
          compileOutput: result.compileOutput,
        })),
      }
    : hidden
      ? {
          passed: execution.results.filter((t) => t.passed).length,
          total: execution.results.length,
          hidden: true,
          results: execution.results.map(({ passed }) => ({
            passed,
            status: passed ? "Passed" : "Failed",
          })),
        }
      : execution;
