import { createHmac, randomInt } from "node:crypto";
import { env } from "../config/env.js";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateAssessmentCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  } while (!/[A-Z]/.test(code) || !/[0-9]/.test(code));
  return code;
}
// A keyed lookup allows indexed matching without storing a readable code.
export const assessmentCodeKey = (code) => createHmac("sha256", env.JWT_SECRET)
  .update("assessment-code:" + code).digest("hex");
