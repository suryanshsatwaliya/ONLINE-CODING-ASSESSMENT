import { api } from "./api";
export const attemptService = {
  get: (id) => api.get("/attempts/" + id),
  start: () => api.post("/attempts/start"),
  save: (id, data) => api.patch("/attempts/" + id + "/answers", data),
  submit: (id) => api.post("/attempts/" + id + "/submit"),
};
