import { z } from "zod";
export const teacherLogin = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});
export const studentVerify = z.object({ uid: z.string().min(1).max(40) });
export const studentLogin = studentVerify.extend({
  assessmentId: z.string().regex(/^[a-f0-9]{24}$/i),
  accessCode: z.string().min(6).max(128),
});
