import { verifyToken } from "../services/auth.service.js";
import { Teacher, Student, AssessmentStudent } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
export async function resolveUser(token) {
  let u;
  try {
    u = verifyToken(token);
  } catch {
    throw new ApiError(401, "Session expired. Please sign in.");
  }
  if (u.role === "TEACHER") {
    if (!(await Teacher.exists({ _id: u.id })))
      throw new ApiError(401, "Account unavailable");
  } else if (u.role === "STUDENT") {
    if (
      !(await Student.exists({ _id: u.id, status: "ACTIVE" })) ||
      !(await AssessmentStudent.exists({
        student: u.id,
        assessment: u.assessmentId,
      }))
    )
      throw new ApiError(403, "Assessment access revoked");
  } else throw new ApiError(401, "Invalid role");
  return u;
}
export const auth = async (req, res, next) => {
  try {
    req.user = await resolveUser(
      req.headers.authorization?.replace(/^Bearer /, ""),
    );
    next();
  } catch (e) {
    next(e);
  }
};
