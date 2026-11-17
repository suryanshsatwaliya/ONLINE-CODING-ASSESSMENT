import crypto from "node:crypto";
import { env } from "../config/env.js";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");
export function makeTotpSecret() {
  const bytes = crypto.randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}
function decodeBase32(value) {
  const clean = value.toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  let bits = "";
  for (const char of clean) { const at = alphabet.indexOf(char); if (at < 0) throw new Error("Invalid TOTP secret"); bits += at.toString(2).padStart(5, "0"); }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function verifyTotp(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code))) return false;
  const key = decodeBase32(secret);
  const counter = Math.floor(now / 30000);
  for (let drift = -1; drift <= 1; drift++) {
    const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(counter + drift));
    const digest = crypto.createHmac("sha1", key).update(message).digest();
    const offset = digest[digest.length - 1] & 15;
    const binary = digest.readUInt32BE(offset) & 0x7fffffff;
    if (String(binary % 1000000).padStart(6, "0") === String(code)) return true;
  }
  return false;
}
export const totpUri = (email, secret) => `otpauth://totp/${encodeURIComponent(`AStarCoders:${email}`)}?secret=${secret}&issuer=AStarCoders&algorithm=SHA1&digits=6&period=30`;
function encryptionKey() {
  const raw = env.ADMIN_TOTP_ENCRYPTION_KEY || "";
  if (!/^[a-f\d]{64}$/i.test(raw)) throw new Error("ADMIN_TOTP_ENCRYPTION_KEY must be 64 hexadecimal characters.");
  return Buffer.from(raw, "hex");
}
export function encryptSecret(value) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}
export function decryptSecret(value) {
  const [iv, tag, data] = String(value).split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
export function makeRecoveryCodes(count = 10) { return Array.from({ length: count }, () => crypto.randomBytes(8).toString("hex").toUpperCase()); }
