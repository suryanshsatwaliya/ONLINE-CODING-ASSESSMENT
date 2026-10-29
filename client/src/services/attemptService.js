import { api } from "./api";
export const attemptService = {
  get: (id) => api.get("/attempts/" + id),
  start: () => api.post("/attempts/start"),
  save: (id, data) => api.patch("/attempts/" + id + "/answers", data),
  progress: (id, questionId) => api.patch("/attempts/" + id + "/progress", { questionId }),
  submit: (id) => api.post("/attempts/" + id + "/submit"),
};
