import "dotenv/config";
import { z } from "zod";
const optionalSecret = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).optional(),
);
const optionalText = z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().optional());
const optionalHexKey = z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().regex(/^[a-f\d]{64}$/i).optional());
const schema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  TURNSTILE_SITE_KEY: optionalSecret,
  TURNSTILE_SECRET_KEY: optionalSecret,
  MASTER_ADMIN_EMAIL: z.preprocess((v) => typeof v === "string" && !v.trim() ? undefined : v, z.string().email().optional()),
  MASTER_ADMIN_PASSWORD: z.preprocess((v) => typeof v === "string" && !v.trim() ? undefined : v, z.string().min(12).max(72).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/).optional()),
  MASTER_ADMIN_PATH: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/).default("control-room"),
  ADMIN_TOTP_ENCRYPTION_KEY: optionalHexKey,
  ADMIN_SESSION_HOURS: z.coerce.number().int().min(1).max(24).default(8),
  RESEND_API_KEY: optionalSecret,
  EMAIL_FROM: optionalText,
  PUBLIC_APP_URL: optionalText,
  VITE_MASTER_ADMIN_PATH: optionalText,
}).refine(
  (values) => Boolean(values.TURNSTILE_SITE_KEY) === Boolean(values.TURNSTILE_SECRET_KEY),
  { message: "Set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY to enable teacher sign-in verification." },
).refine(
  (values) => Boolean(values.MASTER_ADMIN_EMAIL) === Boolean(values.MASTER_ADMIN_PASSWORD),
  { message: "Set both MASTER_ADMIN_EMAIL and MASTER_ADMIN_PASSWORD to provision the Master Admin." },
).refine(
  (values) => !values.MASTER_ADMIN_EMAIL || Boolean(values.ADMIN_TOTP_ENCRYPTION_KEY),
  { message: "ADMIN_TOTP_ENCRYPTION_KEY is required when provisioning a Master Admin." },
);
export const env = { ...process.env, ...schema.parse(process.env) };
