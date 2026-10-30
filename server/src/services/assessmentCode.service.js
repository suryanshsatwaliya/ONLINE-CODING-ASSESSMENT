import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from "node:crypto";
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

const encryptionKey = createHash("sha256").update("assessment-code-encryption:").update(env.JWT_SECRET).digest();

export function encryptAssessmentCode(code) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptAssessmentCode(value) {
  const [ivPart, tagPart, encryptedPart] = String(value || "").split(".");
  if (!ivPart || !tagPart || !encryptedPart) return null;
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
