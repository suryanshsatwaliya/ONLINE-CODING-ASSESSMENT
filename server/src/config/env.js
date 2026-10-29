import "dotenv/config";
import { z } from "zod";
const optionalSecret = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).optional(),
);
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
}).refine(
  (values) => Boolean(values.TURNSTILE_SITE_KEY) === Boolean(values.TURNSTILE_SECRET_KEY),
  { message: "Set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY to enable teacher sign-in verification." },
);
export const env = { ...process.env, ...schema.parse(process.env) };
