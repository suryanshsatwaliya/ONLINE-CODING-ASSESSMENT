import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
process.env.ADMIN_TOTP_ENCRYPTION_KEY ||= "0123456789abcdef".repeat(4);
const { makeTotpSecret, verifyTotp, encryptSecret, decryptSecret, makeRecoveryCodes, hashToken, totpUri } = await import("../src/services/security.service.js");
const QRCode = (await import("qrcode")).default;

function totp(secret, timeMs) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
  for (const char of secret) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((part) => parseInt(part, 2)));
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(Math.floor(timeMs / 30000)));
  const digest = crypto.createHmac("sha1", key).update(message).digest(); const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}

test("TOTP verification matches RFC 6238 and accepts only six digit codes", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(verifyTotp(secret, "287082", 59000), true);
  assert.equal(verifyTotp(secret, "287083", 59000), false);
  assert.equal(verifyTotp(secret, "12345", 59000), false);
});

test("authenticator secrets encrypt at rest and enrollments generate local QR codes", async () => {
  const secret = makeTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.equal(verifyTotp(secret, totp(secret, 1_700_000_000_000), 1_700_000_000_000), true);
  const encrypted = encryptSecret(secret);
  assert.equal(encrypted.includes(secret), false);
  assert.equal(decryptSecret(encrypted), secret);
  assert.throws(() => decryptSecret(`${encrypted.slice(0, -2)}xx`));
  const image = await QRCode.toDataURL(totpUri("admin@example.com", secret));
  assert.match(image, /^data:image\/png;base64,/);
});

test("recovery codes are random, unique, and represented by one-way hashes", () => {
  const codes = makeRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  assert.ok(codes.every((code) => /^[A-F0-9]{16}$/.test(code)));
  assert.notEqual(hashToken(codes[0]), codes[0]);
});
