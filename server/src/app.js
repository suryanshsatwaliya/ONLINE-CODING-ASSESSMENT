import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { apiLimit } from "./middleware/rateLimit.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import studentRoutes from "./routes/student.routes.js";
import questionRoutes from "./routes/question.routes.js";
import questionSetRoutes from "./routes/questionSet.routes.js";
import assessmentRoutes from "./routes/assessment.routes.js";
import attemptRoutes from "./routes/attempt.routes.js";
import codeRoutes from "./routes/code.routes.js";
import proctorRoutes from "./routes/proctor.routes.js";
import resultRoutes from "./routes/result.routes.js";
import aiRoutes from "./routes/ai.routes.js";
export const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL }));
// Bulk assessment authoring includes complete statements, starter code and tests.
app.use("/api/assessments", express.json({ limit: "5mb" }));
app.use("/api/question-sets", express.json({ limit: "5mb" }));
app.use(express.json({ limit: "256kb" }));
app.use("/api", apiLimit);
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", serverTime: new Date() }),
);
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/question-sets", questionSetRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/proctor", proctorRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/ai", aiRoutes);
app.use((req, res) =>
  res
    .status(404)
    .json({ success: false, message: "Route not found", errors: [] }),
);
app.use(errorHandler);
