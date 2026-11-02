import { Router } from "express";
import * as c from "../controllers/questionSet.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { teacher } from "../middleware/teacher.middleware.js";
import { validate, objectIds } from "../middleware/validate.middleware.js";
import { questionSetSchema } from "../validators/assessment.validator.js";
import { teacherCodeRunSchema } from "../validators/submission.validator.js";
import { runLimit } from "../middleware/rateLimit.middleware.js";
import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

const router = Router();
router.use(auth, teacher);
const validSetId = (req, res, next) => mongoose.isValidObjectId(req.params.id)
  ? next()
  : next(new ApiError(400, "Invalid question set identifier"));
router.get("/", c.list);
router.post("/", validate(questionSetSchema), c.create);
router.post("/:id/questions/:index/test-run", validSetId, runLimit, validate(teacherCodeRunSchema), c.testRunQuestion);
router.get("/:id", objectIds, c.get);
router.put("/:id", objectIds, validate(questionSetSchema), c.update);
router.delete("/:id", objectIds, c.remove);
export default router;
