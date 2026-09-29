import { rateLimit } from "express-rate-limit";
const make = (limit, windowMs) =>
  rateLimit({
    limit,
    windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests; please wait.",
      errors: [],
    },
  });
export const apiLimit = make(600, 60000);
export const loginLimit = make(30, 15 * 60000);
export const runLimit = make(15, 60000);
