import ApiError from "../utils/ApiError.js";
export const student = (req, res, next) =>
  req.user.role === "STUDENT"
    ? next()
    : next(new ApiError(403, "Student access required"));
