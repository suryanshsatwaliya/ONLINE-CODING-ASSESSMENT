import { z } from "zod";
export const teacherLogin = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1).max(128),
  captchaToken: z.string().min(1).max(2048).optional(),
});
export const teacherResetRequest = z.object({ identity: z.string().trim().min(1).max(254) });
export const teacherEmailVerification = z.object({ token: z.string().min(32).max(256) });
export const teacherReset = z.object({ token: z.string().min(32).max(256), password: z.string().min(12).max(128), confirmation: z.string().min(12).max(128) });
export const teacherPasswordChange = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
  confirmation: z.string().min(12).max(128),
});
export const teacherUsernameChange = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Use only letters, numbers, dots, underscores, or hyphens."),
});
export const studentVerify = z.object({ uid: z.string().min(1).max(40) });
export const studentLogin = studentVerify.extend({
  accessCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, "Enter the 6-character assessment code."),
});
