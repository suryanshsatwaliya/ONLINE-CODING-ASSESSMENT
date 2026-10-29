import { Router } from "express";
import * as c from "../controllers/auth.controller.js";
import * as v from "../validators/auth.validator.js";
import { validate } from "../middleware/validate.middleware.js";
import { loginLimit } from "../middleware/rateLimit.middleware.js";
import { auth } from "../middleware/auth.middleware.js";
const r = Router();
r.get("/teacher/captcha-config", c.teacherCaptchaConfig);
r.post("/teacher/login", loginLimit, validate(v.teacherLogin), c.teacherLogin);
r.post(
  "/student/verify",
  loginLimit,
  validate(v.studentVerify),
  c.verifyStudent,
);
r.post("/student/login", loginLimit, validate(v.studentLogin), c.studentLogin);
r.get("/me", auth, c.me);
export default r;
