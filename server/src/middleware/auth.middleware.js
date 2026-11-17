import { verifyToken } from "../services/auth.service.js";
import { Teacher, Student, AssessmentStudent, UserSession } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
export async function resolveUser(token) {
  let u;
  try {
    u = verifyToken(token);
  } catch {
    throw new ApiError(401, "Session expired. Please sign in.");
  }
  if (u.role === "TEACHER") {
    const teacher = await Teacher.findById(u.id).select("status tokenVersion sessionsInvalidBefore");
    const tokenIsOld = teacher?.sessionsInvalidBefore && Number(u.iat || 0) * 1000 < +teacher.sessionsInvalidBefore;
    const tokenVersionMismatch = u.tokenVersion !== undefined && Number(u.tokenVersion) !== Number(teacher?.tokenVersion || 0);
    if (!teacher || teacher.status === "INACTIVE" || tokenIsOld || tokenVersionMismatch)
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
  if (u.jti && !(await UserSession.exists({ jti: u.jti, userId: u.id, expiresAt: { $gt: new Date() } }))) throw new ApiError(401, "Session expired. Please sign in.");
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
