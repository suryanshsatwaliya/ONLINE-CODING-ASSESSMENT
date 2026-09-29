import { api } from "./api";
export const studentService = {
  list: () => api.get("/students"),
  create: (data) => api.post("/students", data),
  update: (id, data) => api.put("/students/" + id, data),
  remove: (id) => api.delete("/students/" + id),
};
