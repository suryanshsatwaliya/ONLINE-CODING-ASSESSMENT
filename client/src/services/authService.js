import { api } from "./api";
export const authService = {
  teacherLogin: (data) => api.post("/auth/teacher/login", data),
  verify: (data) => api.post("/auth/student/verify", data),
  studentLogin: (data) => api.post("/auth/student/login", data),
};
