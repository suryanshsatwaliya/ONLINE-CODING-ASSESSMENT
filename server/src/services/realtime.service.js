let io;
export const setIO = (value) => (io = value);
export const emitAssessment = (a, event, data) => {
  io?.to("teacher:" + a.createdBy).emit(event, data);
  io?.to("assessment:" + a._id).emit(event, data);
};
export const emitAttempt = (a, t) => {
  io?.to("teacher:" + a.createdBy).emit("MONITOR_UPDATE", { attemptId: t._id });
  io?.to("student:" + t.student).emit("ATTEMPT_UPDATE", {
    attemptId: t._id,
    status: t.status,
    warningCount: t.warningCount,
  });
};
