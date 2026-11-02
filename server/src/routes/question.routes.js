import { Router } from "express";
import * as c from "../controllers/question.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { teacher } from "../middleware/teacher.middleware.js";
import { student } from "../middleware/student.middleware.js";
import { validate, objectIds } from "../middleware/validate.middleware.js";
import { questionSchema } from "../validators/assessment.validator.js";
import { teacherCodeRunSchema } from "../validators/submission.validator.js";
import { rateLimit } from "express-rate-limit";
import { runLimit } from "../middleware/rateLimit.middleware.js";
const r = Router();
r.use(auth);
r.use(teacher);
r.get("/", c.list);
r.get("/reference", c.reference);
r.post("/leetcode/import", rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30,
  message: { message: "Too many imports. Please wait before trying again.", errors: [] },
}), c.importProblem);
r.post("/:id/test-run", objectIds, runLimit, validate(teacherCodeRunSchema), c.testRun);
r.post("/", validate(questionSchema), c.create);
r.put("/:id", objectIds, validate(questionSchema), c.update);
r.delete("/:id", objectIds, c.remove);
r.get("/:id", objectIds, c.getOne);
export default r;
