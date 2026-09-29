import ApiError from "../utils/ApiError.js";
export const teacher = (req, res, next) =>
  req.user.role === "TEACHER"
    ? next()
    : next(new ApiError(403, "Teacher access required"));
