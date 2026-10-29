import { z } from "zod";
export const teacherLogin = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  captchaToken: z.string().min(1).max(2048).optional(),
});
export const studentVerify = z.object({ uid: z.string().min(1).max(40) });
export const studentLogin = studentVerify.extend({
  accessCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, "Enter the 6-character assessment code."),
});
