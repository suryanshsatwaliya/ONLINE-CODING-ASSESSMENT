import { api } from "./api";
export const assessmentService = {
  list: () => api.get("/assessments"),
  get: (id) => api.get("/assessments/" + id),
  create: (data) => api.post("/assessments", data),
  update: (id, data) => api.put("/assessments/" + id, data),
  remove: (id) => api.delete("/assessments/" + id),
  extendMonitorTime: (id, data) => api.post(`/assessments/${id}/monitor/time`, data),
  restartStudentAttempt: (id, studentId, mode) => api.post(`/assessments/${id}/monitor/students/${studentId}/restart`, { mode }),
};
