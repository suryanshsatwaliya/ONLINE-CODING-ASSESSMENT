import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
export const validate = (s) => (req, res, next) => {
  try {
    req.body = s.parse(req.body);
    next();
  } catch (e) {
    next(e);
  }
};
export const objectIds = (req, res, next) => {
  if (Object.values(req.params).some((x) => !mongoose.isValidObjectId(x)))
    return next(new ApiError(400, "Invalid identifier"));
  next();
};
