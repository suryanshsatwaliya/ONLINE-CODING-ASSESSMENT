import { Router } from "express";
import * as c from "../controllers/result.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { teacher } from "../middleware/teacher.middleware.js";
import { student } from "../middleware/student.middleware.js";
import { validate, objectIds } from "../middleware/validate.middleware.js";

const r = Router();
r.use(auth);
r.get("/mine/:id", student, objectIds, c.mine);
r.use(teacher);
r.get("/submissions", c.submissions);
r.get("/attempt/:id", objectIds, c.detail);
r.post("/retry/:id", objectIds, c.retry);
r.get("/:id", objectIds, c.list);
export default r;
