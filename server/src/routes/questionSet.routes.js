import { Router } from "express";
import * as c from "../controllers/questionSet.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { teacher } from "../middleware/teacher.middleware.js";
import { validate, objectIds } from "../middleware/validate.middleware.js";
import { questionSetSchema } from "../validators/assessment.validator.js";

const router = Router();
router.use(auth, teacher);
router.get("/", c.list);
router.post("/", validate(questionSetSchema), c.create);
router.get("/:id", objectIds, c.get);
router.put("/:id", objectIds, validate(questionSetSchema), c.update);
router.delete("/:id", objectIds, c.remove);
export default router;
