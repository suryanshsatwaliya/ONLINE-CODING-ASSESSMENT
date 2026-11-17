import { api } from "./api";
export const authService = {
  teacherLogin: (data) => api.post("/auth/teacher/login", data),
  logout: () => api.post("/auth/logout", {}, { headers: { Authorization: `Bearer ${sessionStorage.getItem("token") || ""}` } }),
  teacherCaptchaConfig: () => api.get("/auth/teacher/captcha-config"),
  verify: (data) => api.post("/auth/student/verify", data),
  studentLogin: (data) => api.post("/auth/student/login", data),
};
