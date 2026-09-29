import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
export const issueToken = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: "quiz-portal",
    audience: "quiz-portal",
  });
export const verifyToken = (token) =>
  jwt.verify(token, env.JWT_SECRET, {
    issuer: "quiz-portal",
    audience: "quiz-portal",
    algorithms: ["HS256"],
  });
