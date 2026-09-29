import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
});
export const env = { ...process.env, ...schema.parse(process.env) };
