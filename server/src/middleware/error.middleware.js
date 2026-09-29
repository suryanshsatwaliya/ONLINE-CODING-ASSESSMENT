export const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  if (err.name === "ZodError") {
    status = 422;
    message = "Validation failed";
  }
  if (err.code === 11000) {
    status = 409;
    message = "Record already exists";
  }
  if (err.name === "CastError") {
    status = 400;
    message = "Invalid identifier";
  }
  if (status === 500) {
    console.error(err);
    message = "An internal error occurred";
  }
  res
    .status(status)
    .json({ success: false, message, errors: err.issues || err.errors || [] });
};
