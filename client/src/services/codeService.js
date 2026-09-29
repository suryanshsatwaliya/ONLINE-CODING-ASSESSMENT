import { api } from "./api";
export const codeService = {
  run: (data) => api.post("/code/run", data),
  submit: (data) => api.post("/code/submit", data),
  get: (id) => api.get("/code/" + id),
};
