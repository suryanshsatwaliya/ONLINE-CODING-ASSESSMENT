import ApiError from "../utils/ApiError.js";

const origin = "https://leetcode.com";
let catalog, catalogExpires = 0, catalogRequest;
const query = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId title titleSlug content difficulty isPaidOnly
    exampleTestcases metaData topicTags { name }
  }
}`;

async function request(path, body) {
  try {
    const response = await fetch(origin + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Upstream unavailable");
    return await response.json();
  } catch {
    throw new ApiError(502, "LeetCode is unavailable or blocked this request. Try again later, or enter the problem manually.");
  }
}

export function parseProblemNumber(reference) {
  const match = String(reference || "").trim().match(/^(?:leetcode\s*#?\s*)?([1-9]\d{0,5})$/i);
  if (!match) throw new ApiError(422, 'Enter a problem number, such as "LeetCode 67" or "67".');
  return match[1];
}

export function plainText(html) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(html || "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>/gi, "^($1)")
    .replace(/<\s*br\s*\/?\s*>|<\/(?:p|div|pre|li|ul|ol|h[1-6])\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, name) => {
      if (name[0] !== "#") return entities[name.toLowerCase()] || match;
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function convertProblem(problem) {
  if (!problem || problem.isPaidOnly || !problem.content)
    throw new ApiError(422, "This problem is not publicly available. You can create a coding question manually.");
  const content = plainText(problem.content);
  let metadata = {};
  try { metadata = JSON.parse(problem.metaData || "{}"); } catch { /* Imported content remains editable. */ }
  const params = Array.isArray(metadata.params) ? metadata.params : [];
  const inputs = String(problem.exampleTestcases || "").trim().split(/\r?\n/);
  const examples = [], testCases = [];
  const warnings = ["Public examples are imported. LeetCode's private judging tests are not available; add your own hidden grading cases before using this set in an assessment."];
  let blocks = content.split(/(?:^|\n)\s*Example\s*\d+\s*:\s*/i).slice(1)
    .map((block) => block.split(/\n\s*(?:Constraints|Follow[ -]?up)\s*:/i)[0]);
  if (!blocks.length) blocks = [...problem.content.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)].map((block) => plainText(block[1]));
  blocks = blocks.filter((block) => /Input\s*:/i.test(block) && /Output\s*:/i.test(block));
  const aligned = params.length && inputs.length === blocks.length * params.length;
  const json = (value) => JSON.stringify(JSON.parse(value, (_, item) => {
    if (typeof item === "number" && Number.isInteger(item) && !Number.isSafeInteger(item)) throw new Error("Unsafe integer");
    return item;
  }));
  blocks.slice(0, 20).forEach((block, i) => {
    const input = block.match(/Input\s*:\s*([\s\S]*?)\s*Output\s*:/i)?.[1]?.trim() || "";
    const output = block.match(/Output\s*:\s*([\s\S]*?)(?:\s*(?:Explanation|Note)\s*:|$)/i)?.[1]?.trim() || "";
    const explanation = block.match(/(?:Explanation|Note)\s*:\s*([\s\S]*)/i)?.[1]?.trim() || "";
    const example = { input, output, explanation };
    try {
      if (!aligned) throw new Error("Unmatched example inputs");
      const stdin = inputs.slice(i * params.length, (i + 1) * params.length).map(json).join("\n");
      const expectedOutput = json(output);
      example.input = stdin;
      example.output = expectedOutput;
      testCases.push({ input: stdin, expectedOutput, hidden: false, weight: 1 });
    } catch { /* Retain the original example without inventing a runnable test. */ }
    examples.push(example);
  });
  if (testCases.length !== examples.length || !examples.length)
    warnings.push("Some examples need manual input/output adaptation. Their original text and explanations are preserved, but only reliably converted examples become runnable tests.");
  if (blocks.length > 20) warnings.push("The first 20 examples are editable below; remaining examples are preserved in the statement where space permits.");
  if (content.length > 20000) warnings.push("The statement exceeds the editor limit and was shortened. Review the original source for the remaining content.");
  if (metadata.systemdesign || params.some((p) => !/^(?:integer|long|double|float|boolean|string|character)(?:\[\])*$/i.test(p.type || "")))
    warnings.push("This problem may use special data structures or a custom checker. Adapt the input/output format and starter code before using it.");
  const count = params.length;
  const python = `import json\nimport sys\n\ndef solve(*args):\n    # TODO: implement the solution. Arguments are decoded JSON values.\n    raise NotImplementedError("Implement solve")\n\nargs = [json.loads(line) for line in sys.stdin.read().splitlines() if line.strip()]\nresult = solve(*args)\nprint(json.dumps(result, separators=(',', ':')))\n`;
  const javascript = `const fs = require('fs');\n\nfunction solve(...args) {\n  // TODO: implement the solution. Arguments are decoded JSON values.\n  throw new Error('Implement solve');\n}\n\nconst args = fs.readFileSync(0, 'utf8').trim().split(/\\r?\\n/).filter(Boolean).map(JSON.parse);\nconsole.log(JSON.stringify(solve(...args)));\n`;
  return {
    question: {
      title: `${problem.questionFrontendId}. ${problem.title}`.slice(0, 200),
      type: "CODING", source: "EXTERNAL",
      externalReference: `${origin}/problems/${problem.titleSlug}/`,
      description: content.slice(0, 20000),
      constraints: (content.split(/Constraints\s*:/i)[1] || "").slice(0, 20000).trim(),
      difficulty: ["EASY", "MEDIUM", "HARD"].includes(problem.difficulty?.toUpperCase()) ? problem.difficulty.toUpperCase() : "MEDIUM",
      tags: (problem.topicTags || []).slice(0, 20).map((tag) => tag.name.slice(0, 50)),
      inputFormat: count
        ? `Read ${count} JSON value(s), one per line, in this order: ${params.map((p) => `${p.name} (${p.type})`).join(", ")}. Strings include double quotes. Adapt special data structures from their JSON representation.`
        : "Define and review the standard-input format for this problem before saving.",
      outputFormat: "Print the result as compact JSON on one line, with no extra messages. String results must include double quotes. The runner compares output text; define one exact expected output for each test.",
      examples,
      testCases,
      starterCode: { python, javascript },
      supportedLanguages: ["python", "javascript"],
    },
    warnings,
  };
}

export async function importLeetcode(reference) {
  const number = parseProblemNumber(reference);
  if (!catalog || Date.now() > catalogExpires) {
    if (!catalogRequest) catalogRequest = request("/api/problems/all/").then((result) => {
      if (!Array.isArray(result.stat_status_pairs)) throw new ApiError(502, "LeetCode returned an unexpected problem list. Try again later.");
      catalog = result.stat_status_pairs;
      catalogExpires = Date.now() + 3600000;
    }).finally(() => { catalogRequest = null; });
    await catalogRequest;
  }
  const entry = catalog.find((item) => String(item.stat?.frontend_question_id) === number);
  if (!entry) throw new ApiError(404, `LeetCode problem ${number} was not found.`);
  if (entry.paid_only) throw new ApiError(422, "This is a premium problem and cannot be imported. Create it manually using content you can use.");
  const slug = entry.stat.question__title_slug;
  const result = await request("/graphql/", { query, variables: { titleSlug: slug } });
  if (result.errors || !result.data?.question) throw new ApiError(502, "LeetCode did not return the problem. Try again later.");
  if (String(result.data.question.questionFrontendId) !== number) throw new ApiError(502, "LeetCode returned a different problem. No content was imported.");
  return convertProblem(result.data.question);
}

