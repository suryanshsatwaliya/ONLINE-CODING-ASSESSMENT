import { env } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

export const teacherCaptchaEnabled = Boolean(
  env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY,
);

export async function verifyTeacherCaptcha(token) {
  if (!teacherCaptchaEnabled) return;
  if (typeof token !== "string" || !token.trim() || token.length > 2048) {
    throw new ApiError(400, "Complete the human verification before signing in.");
  }

  let response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Turnstile Siteverify returned an error.");
    const result = await response.json();
    if (result.success !== true) {
      throw new ApiError(400, "Human verification failed or expired. Please try again.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Human verification is temporarily unavailable. Please try again.");
  }
}
