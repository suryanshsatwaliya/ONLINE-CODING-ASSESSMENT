import ApiError from "../utils/ApiError.js";

const origin = "https://leetcode.com";
const query = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId title titleSlug content difficulty isPaidOnly
    exampleTestcases metaData topicTags { name }
    codeSnippets { lang langSlug code }
  }
}`;
// LeetCode exposes problem numbers on its public problem-list GraphQL query.
// Resolve a number to its canonical slug first, then use the same detail query
// as URL/slug imports. LeetCode's keyword search is not reliable for frontend
// IDs, so the public catalog is also scanned and matched by exact ID.
const problemNumberQuery = `query problemsetQuestionListV2($filters: QuestionFilterInput, $limit: Int, $searchKeyword: String, $skip: Int, $sortBy: QuestionSortByInput, $categorySlug: String) {
  problemsetQuestionListV2(filters: $filters, limit: $limit, searchKeyword: $searchKeyword, skip: $skip, sortBy: $sortBy, categorySlug: $categorySlug) {
    questions { questionFrontendId titleSlug title paidOnly }
    totalLength
    hasMore
  }
}`;
const numberSlugCache = new Map();
const problemPageSize = 100;

async function request(path, body) {
  try {
    const response = await fetch(origin + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Origin: origin,
        Referer: `${origin}/problemset/`,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "unknown";
      const responseBody = (await response.text().catch(() => "")).slice(0, 4000);
      let upstreamErrors;
      try {
        const parsedBody = JSON.parse(responseBody);
        upstreamErrors = Array.isArray(parsedBody.errors)
          ? parsedBody.errors.map((item) => item.message).filter(Boolean).slice(0, 5)
          : undefined;
      } catch { /* Non-JSON upstream bodies are summarized by bodyHint. */ }
      const bodyHint = /cloudflare|captcha|verify you are human|access denied/i.test(responseBody)
        ? "challenge-or-access-denied"
        : /rate.?limit|too many requests/i.test(responseBody)
          ? "rate-limit"
          : responseBody.trim()
            ? "unrecognized-error-body"
            : "empty-body";
      console.warn("LeetCode import upstream rejection", {
        path,
        status: response.status,
        statusText: response.statusText,
        bodyHint,
        upstreamErrors,
        contentType,
        retryAfter: response.headers.get("retry-after"),
        cloudflareRay: response.headers.get("cf-ray"),
      });

      let reason = "LeetCode is temporarily unavailable. Try again later, or enter the problem manually.";
      if (response.status === 403) {
        reason = "LeetCode denied this server's import request (HTTP 403). Its access protection is blocking the server request. Try later or enter the problem manually.";
      } else if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        reason = `LeetCode rate-limited this server (HTTP 429)${retryAfter ? `; Retry-After: ${retryAfter}` : ""}. Wait before importing again, or enter the problem manually.`;
      }
      throw new ApiError(502, reason);
    }
    try {
      return await response.json();
    } catch {
      throw new ApiError(502, "LeetCode returned an unexpected response. Try again later, or enter the problem manually.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "LeetCode could not be reached. Check the server's internet connection, then try again or enter the problem manually.");
  }
}

export function parseProblemSlug(reference) {
  const value = String(reference || "").trim();
  if (!value) throw new ApiError(422, "Enter a LeetCode problem URL or title slug, such as https://leetcode.com/problems/two-sum/.");
  if (/^\d+$/.test(value)) throw new ApiError(422, "Enter a problem URL or title slug here; numeric problem IDs are resolved separately.");

  let slug = value;
  if (/^(?:https?:\/\/)?(?:www\.)?leetcode\.com\//i.test(value)) {
    let url;
    try { url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); }
    catch { throw new ApiError(422, "That LeetCode URL is not valid. Paste a problem URL or enter its title slug."); }
    if (!['leetcode.com', 'www.leetcode.com'].includes(url.hostname.toLowerCase()))
      throw new ApiError(422, "Only leetcode.com problem URLs can be imported.");
    slug = url.pathname.match(/^\/problems\/([a-z0-9-]+)(?:\/|$)/i)?.[1] || "";
  }

  slug = slug.replace(/^\/|\/$/g, "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug))
    throw new ApiError(422, "Enter a LeetCode problem number, URL, or title slug (for example, 1 or two-sum).");
  return slug.toLowerCase();
}

function isProblemNumber(reference) {
  return /^\d+$/.test(String(reference || "").trim());
}

function isProblemUrl(reference) {
  return /^(?:https?:\/\/)?(?:www\.)?leetcode\.com\/problems\/[a-z0-9-]+(?:\/|$)/i.test(String(reference || "").trim());
}

async function resolveProblemNumber(reference) {
  const number = String(Number(String(reference).trim()));
  if (!number || number === "NaN") throw new ApiError(422, "Enter a valid LeetCode problem number.");
  const cached = numberSlugCache.get(number);
  if (cached) return cached;

  const fetchProblemPage = async ({ skip, searchKeyword = "", quietGraphQLErrors = false }) => {
    const result = await request("/graphql/", {
      operationName: "problemsetQuestionListV2",
      query: problemNumberQuery,
      variables: {
        categorySlug: "all-code-essentials",
        skip,
        limit: problemPageSize,
        searchKeyword: searchKeyword || "",
        filters: {
          filterCombineType: "ALL",
          statusFilter: { questionStatuses: [], operator: "IS" },
          difficultyFilter: { difficulties: [], operator: "IS" },
          languageFilter: { languageSlugs: [], operator: "IS" },
          topicFilter: { topicSlugs: [], operator: "IS" },
          acceptanceFilter: {},
          frequencyFilter: {},
          frontendIdFilter: {},
          lastSubmittedFilter: {},
          publishedFilter: {},
          companyFilter: { companySlugs: [], operator: "IS" },
          premiumFilter: { premiumStatus: [], operator: "IS" },
        },
        sortBy: { sortField: "CUSTOM", sortOrder: "ASCENDING" },
      },
    });
    if (result.errors || !Array.isArray(result.data?.problemsetQuestionListV2?.questions)) {
      if (!quietGraphQLErrors) {
        console.warn("LeetCode problem number lookup returned GraphQL errors", {
          skip,
          searchKeyword,
          errors: result.errors?.map((item) => item.message).filter(Boolean),
        });
      }
      throw new ApiError(502, "LeetCode could not look up that problem number. Try its problem URL or title slug instead.");
    }
    return result.data.problemsetQuestionListV2;
  };

  let listing = null;
  try {
    listing = await fetchProblemPage({ skip: 0, searchKeyword: number, quietGraphQLErrors: true });
  } catch (error) {
    // A GraphQL-level failure from the optional keyword search should not stop
    // numeric imports: continue with the unfiltered public catalog below.
    // HTTP/network failures still surface as-is so an upstream block isn't
    // misreported as an invalid problem number.
    if (!(error instanceof ApiError) || !/could not look up that problem number/i.test(error.message)) {
      throw error;
    }
  }
  let match = listing?.questions.find((item) => String(item.questionFrontendId).trim() === number);

  // LeetCode's search keyword may fail or omit frontend IDs. Page through the
  // unfiltered public catalog and compare the numeric ID ourselves.
  if (!match) {
    const firstCatalogPage = await fetchProblemPage({ skip: 0 });
    const totalLength = Math.max(0, Number(firstCatalogPage.totalLength) || 0);
    for (let skip = 0; skip < totalLength; skip += problemPageSize) {
      const page = skip === 0 ? firstCatalogPage : await fetchProblemPage({ skip });
      match = page.questions.find((item) => String(item.questionFrontendId).trim() === number);
      if (match) break;
      if (!page.hasMore) break;
    }
  }
  if (!match?.titleSlug) {
    throw new ApiError(404, `LeetCode problem ${number} was not found. Check the number, or import it using its problem URL.`);
  }
  if (match.paidOnly) {
    throw new ApiError(422, "This is a premium problem and cannot be imported. Create it manually using content you can use.");
  }
  numberSlugCache.set(number, match.titleSlug);
  return match.titleSlug;
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
  const statement = content.split(/(?:^|\n)\s*(?:Example\s*\d+\s*:|Constraints\s*:|Follow[ -]?up\s*:)/i)[0].trim();
  const constraints = content.match(/(?:^|\n)\s*Constraints\s*:\s*([\s\S]*?)(?=\n\s*Follow[ -]?up\s*:|$)/i)?.[1]?.trim() || "";
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
  const languageBySlug = { c: "c", cpp: "cpp", java: "java", python: "python", python3: "python", javascript: "javascript" };
  const starterCode = {};
  for (const snippet of problem.codeSnippets || []) {
    const language = languageBySlug[snippet.langSlug];
    if (language && !starterCode[language] && typeof snippet.code === "string")
      starterCode[language] = snippet.code;
  }
  const languageOrder = ["python", "javascript", "cpp", "java", "c"];
  const supportedLanguages = languageOrder.filter((language) => starterCode[language]);
  const inferredMethod = Object.values(starterCode).map((code) =>
    code.match(/\bdef\s+(\w+)\s*\(/)?.[1] ||
    code.match(/(?:\b(?:var|let|const)\s+)?(\w+)\s*=\s*function\s*\(/)?.[1] ||
    code.match(/\bfunction\s+(\w+)\s*\(/)?.[1] ||
    code.match(/\b(\w+)\s*\([^;{}]*\)\s*\{/g)?.map((match) => match.match(/\b(\w+)\s*\(/)?.[1]).find((name) => name && !["if", "for", "while", "switch"].includes(name)),
  ).find(Boolean);
  const methodName = String(metadata.name || inferredMethod || "").trim();
  const executionConfig = /^[A-Za-z_$][\w$]*$/.test(methodName) && params.length
    ? { mode: "LEETCODE", methodName, params: params.map(({ name, type }) => ({ name: String(name || ""), type: String(type || "") })), returnType: String(metadata.return?.type || "") }
    : undefined;
  if (!supportedLanguages.length) {
    starterCode.python = `import json\nimport sys\n\ndef solve(*args):\n    # TODO: implement the solution. Arguments are decoded JSON values.\n    raise NotImplementedError("Implement solve")\n\nargs = [json.loads(line) for line in sys.stdin.read().splitlines() if line.strip()]\nresult = solve(*args)\nprint(json.dumps(result, separators=(',', ':')))\n`;
    starterCode.javascript = `const fs = require('fs');\n\nfunction solve(...args) {\n  // TODO: implement the solution. Arguments are decoded JSON values.\n  throw new Error('Implement solve');\n}\n\nconst args = fs.readFileSync(0, 'utf8').trim().split(/\\r?\\n/).filter(Boolean).map(JSON.parse);\nconsole.log(JSON.stringify(solve(...args)));\n`;
    supportedLanguages.push("python", "javascript");
    warnings.push("LeetCode starter templates were unavailable, so editable standard-input templates were added instead.");
  } else {
    warnings.push(executionConfig
      ? "LeetCode method submissions are wrapped to run against these JSON test inputs. You can also replace the starter with a complete program that reads standard input and prints its result."
      : "The method signature could not be identified automatically. Review the starter code and provide a complete standard-input program before using this question.");
  }
  return {
    question: {
      title: String(problem.title || "").slice(0, 200),
      type: "CODING", source: "EXTERNAL",
      externalReference: `${origin}/problems/${problem.titleSlug}/`,
      description: statement.slice(0, 20000),
      constraints: constraints.slice(0, 20000),
      difficulty: ["EASY", "MEDIUM", "HARD"].includes(problem.difficulty?.toUpperCase()) ? problem.difficulty.toUpperCase() : "MEDIUM",
      tags: (problem.topicTags || []).slice(0, 20).map((tag) => tag.name.slice(0, 50)),
      inputFormat: count
        ? `Read ${count} JSON value(s), one per line, in this order: ${params.map((p) => `${p.name} (${p.type})`).join(", ")}. Strings include double quotes. Adapt special data structures from their JSON representation.`
        : "Define and review the standard-input format for this problem before saving.",
      outputFormat: "Print the result as compact JSON on one line, with no extra messages. String results must include double quotes. The runner compares output text; define one exact expected output for each test.",
      examples,
      testCases,
      starterCode,
      ...(executionConfig ? { executionConfig } : {}),
      supportedLanguages,
    },
    warnings,
  };
}

export async function importLeetcodeProblem(reference) {
  if (!isProblemNumber(reference) && !isProblemUrl(reference)) {
    throw new ApiError(422, "Enter a LeetCode problem number or problem URL. Title slugs by themselves are not accepted.");
  }
  const slug = isProblemNumber(reference)
    ? await resolveProblemNumber(reference)
    : parseProblemSlug(reference);
  const result = await request("/graphql/", { query, variables: { titleSlug: slug } });
  if (result.errors || !result.data?.question) throw new ApiError(502, "LeetCode did not return the problem. Try again later.");
  if (result.data.question.isPaidOnly) throw new ApiError(422, "This is a premium problem and cannot be imported. Create it manually using content you can use.");
  const imported = convertProblem(result.data.question);
  imported.question.title = `${result.data.question.questionFrontendId}. ${result.data.question.title}`;
  return imported;
}

