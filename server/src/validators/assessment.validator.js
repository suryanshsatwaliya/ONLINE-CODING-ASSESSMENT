import { z } from "zod";
const text = z.string().max(20000);
export const events = [
  "FULLSCREEN_EXIT",
  "TAB_HIDDEN",
  "WINDOW_BLUR",
  "WINDOW_FOCUS",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "CUT_ATTEMPT",
  "CONTEXT_MENU_ATTEMPT",
  "PAGE_EXIT_ATTEMPT",
  "DISCONNECTED",
  "RECONNECTED",
];
export const securitySchema = z.object({
  requireFullscreen: z.boolean().default(true),
  monitorTabSwitching: z.boolean().default(true),
  monitorWindowFocus: z.boolean().default(true),
  monitorPageExit: z.boolean().default(true),
  blockCopy: z.boolean().default(true),
  blockPaste: z.boolean().default(true),
  blockCut: z.boolean().default(true),
  blockContextMenu: z.boolean().default(false),
  maxWarnings: z.number().int().min(1).max(100).default(3),
  warningAction: z.enum(["AUTO_SUBMIT", "TERMINATE"]).default("AUTO_SUBMIT"),
  eventRules: z
    .record(z.enum(events), z.enum(["IGNORE", "LOG", "WARNING"]))
    .default({
      FULLSCREEN_EXIT: "WARNING",
      TAB_HIDDEN: "WARNING",
      WINDOW_BLUR: "LOG",
      COPY_ATTEMPT: "WARNING",
      PASTE_ATTEMPT: "WARNING",
      CUT_ATTEMPT: "WARNING",
      DISCONNECTED: "LOG",
      RECONNECTED: "LOG",
    }),
});
const questionFields = z
  .object({
    title: z.string().min(1).max(200),
    question: text.default(""),
    type: z.enum(["SINGLE", "MULTIPLE", "TRUE_FALSE", "SHORT", "CODING"]),
    marks: z.number().min(0.1).max(1000),
    negativeMarks: z.number().min(0).max(100).default(0),
    options: z.array(z.string().max(2000)).max(20).default([]),
    correctAnswer: z
      .union([z.string().max(2000), z.array(z.number().int())])
      .default(""),
    explanation: text.default(""),
    description: text.default(""),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("EASY"),
    constraints: text.default(""),
    inputFormat: text.default(""),
    outputFormat: text.default(""),
    examples: z
      .array(z.object({ input: text, output: text, explanation: text.default("") }))
      .max(20)
      .default([]),
    starterCode: z.record(z.string().max(50000)).default({}),
    supportedLanguages: z
      .array(z.enum(["c", "cpp", "java", "python", "javascript"]))
      .default(["python", "cpp", "java", "javascript", "c"]),
    timeLimit: z.number().min(0.1).max(5).default(2),
    memoryLimit: z.number().int().min(16000).max(256000).default(128000),
    testCases: z
      .array(
        z.object({
          input: text,
          expectedOutput: text,
          hidden: z.boolean(),
          weight: z.number().positive().max(100),
        }),
      )
      .max(30)
      .default([]),
    source: z.enum(["MANUAL", "INTERNAL", "EXTERNAL"]).default("MANUAL"),
    externalReference: z.string().max(500).default(""),
    tags: z.array(z.string().max(50)).max(20).default([]),
    qualityMarks: z.number().min(0).max(100).default(0),
    efficiencyMarks: z.number().min(0).max(100).default(0),
  });
function validateQuestion(q, ctx, requireHidden = true) {
    const err = (m) => ctx.addIssue({ code: "custom", message: m });
    if (["SINGLE", "MULTIPLE", "TRUE_FALSE"].includes(q.type)) {
      if (
        q.options.length < 2 ||
        !Array.isArray(q.correctAnswer) ||
        !q.correctAnswer.length ||
        q.correctAnswer.some((i) => i < 0 || i >= q.options.length) ||
        new Set(q.correctAnswer).size !== q.correctAnswer.length
      )
        err("Choose valid correct option indexes");
      if (q.type !== "MULTIPLE" && q.correctAnswer.length !== 1)
        err("Select exactly one correct answer");
    }
    if (
      q.type === "SHORT" &&
      (typeof q.correctAnswer !== "string" || !q.correctAnswer.trim())
    )
      err("Short answer needs a reference answer");
    if (
      q.type === "CODING" &&
      ((requireHidden && !q.testCases.some((t) => t.hidden)) || !q.supportedLanguages.length)
    )
      err("Coding questions require hidden tests and a language");
}
export const questionSchema = questionFields.superRefine(validateQuestion);
export const bankQuestionSchema = questionFields.superRefine((q, ctx) => {
  validateQuestion(q, ctx, false);
  if (!q.title.trim() || !(q.type === "CODING" ? q.description : q.question).trim())
    ctx.addIssue({ code: "custom", message: "Enter the question text or problem statement" });
  if (q.type !== "CODING" && q.type !== "SHORT" && q.options.some((option) => !option.trim()))
    ctx.addIssue({ code: "custom", message: "Answer options cannot be empty" });
});
export const questionSetSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: text.default(""),
  type: z.enum(["QUIZ", "CODING"]),
  questions: z.array(bankQuestionSchema).min(1).max(100),
  revision: z.number().int().min(0).optional(),
}).superRefine((set, ctx) => {
  set.questions.forEach((q, index) => {
    if (set.type === "CODING" ? q.type !== "CODING" : !["SINGLE", "MULTIPLE", "TRUE_FALSE"].includes(q.type))
      ctx.addIssue({ code: "custom", path: ["questions", index], message: "Question type does not match this set" });
  });
});
export const assessmentSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: text.default(""),
    instructions: text.default(""),
    type: z.enum(["QUIZ", "CODING", "MIXED"]),
    duration: z.number().int().min(1).max(480),
    startTime: z.string().datetime().nullable().optional(),
    endTime: z.string().datetime().nullable().optional(),
    status: z.enum(["DRAFT", "SCHEDULED"]).default("DRAFT"),
    questionIds: z
      .array(z.string().regex(/^[a-f0-9]{24}$/i))
      .max(100)
      .default([]),
    questionSetIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(100).default([]),
    newQuestions: z.never().optional(),
    securitySettings: securitySchema.default({}),
    randomizeQuestions: z.boolean().default(false),
    randomizeOptions: z.boolean().default(false),
    publishResults: z.boolean().default(false),
    aiEnabled: z.boolean().default(false),
    aiRubric: text.default("Assess code quality, readability and efficiency."),
    maxCodeRuns: z.number().int().min(0).max(1000).default(0),
  })
  .refine(
    (a) =>
      !a.startTime || !a.endTime || new Date(a.endTime) > new Date(a.startTime),
    "End time must follow start time",
  )
  .refine(
    (a) => new Set(a.questionSetIds).size === a.questionSetIds.length,
    "A question set can only be selected once",
  );
