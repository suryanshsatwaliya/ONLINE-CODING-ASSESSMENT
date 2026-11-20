import { Router } from "express";
import * as c from "../controllers/auth.controller.js";
import * as v from "../validators/auth.validator.js";
import { validate } from "../middleware/validate.middleware.js";
import { loginLimit, passwordResetLimit } from "../middleware/rateLimit.middleware.js";
import { auth } from "../middleware/auth.middleware.js";
import { teacher } from "../middleware/teacher.middleware.js";
const r = Router();
r.get("/teacher/captcha-config", c.teacherCaptchaConfig);
r.post("/teacher/login", loginLimit, validate(v.teacherLogin), c.teacherLogin);
r.post("/teacher/forgot-password", passwordResetLimit, validate(v.teacherResetRequest), c.requestTeacherReset);
r.post("/teacher/verify-email", passwordResetLimit, validate(v.teacherEmailVerification), c.verifyTeacherEmail);
r.post("/teacher/reset-password", passwordResetLimit, validate(v.teacherReset), c.resetTeacherPassword);
r.post("/teacher/change-password", auth, teacher, validate(v.teacherPasswordChange), c.changeTeacherPassword);
r.patch("/teacher/username", auth, teacher, validate(v.teacherUsernameChange), c.changeTeacherUsername);
r.post(
  "/student/verify",
  loginLimit,
  validate(v.studentVerify),
  c.verifyStudent,
);
r.post("/student/login", loginLimit, validate(v.studentLogin), c.studentLogin);
r.get("/me", auth, c.me);
r.post("/logout", auth, c.logout);
export default r;
