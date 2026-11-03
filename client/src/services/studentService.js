import { api } from "./api";
export const studentService = {
  list: () => api.get("/students"),
  create: (data) => api.post("/students", data),
  createMany: (students) => api.post("/students/bulk", { students }),
  update: (id, data) => api.put("/students/" + id, data),
  remove: (id) => api.delete("/students/" + id),
};
