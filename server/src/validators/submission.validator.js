import { z } from "zod";
import { events } from "./assessment.validator.js";
export const answerSchema = z.object({
  questionId: z.string().max(100),
  value: z.union([
    z.string().max(50000),
    z.array(z.number().int()).max(20),
    z.object({
      code: z.string().max(50000),
      language: z.enum(["c", "cpp", "java", "python", "javascript"]),
    }),
  ]),
  marked: z.boolean().default(false),
});
export const codeSchema = z.object({
  attemptId: z.string().regex(/^[a-f0-9]{24}$/i),
  questionId: z.string().max(100),
  language: z.enum(["c", "cpp", "java", "python", "javascript"]),
  code: z.string().min(1).max(50000),
});
export const eventSchema = z.object({
  attemptId: z.string().regex(/^[a-f0-9]{24}$/i),
  eventId: z.string().uuid(),
  eventType: z.enum(events),
});
