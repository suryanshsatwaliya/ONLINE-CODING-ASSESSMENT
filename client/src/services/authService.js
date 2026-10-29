import { api } from "./api";
export const authService = {
  teacherLogin: (data) => api.post("/auth/teacher/login", data),
  teacherCaptchaConfig: () => api.get("/auth/teacher/captcha-config"),
  verify: (data) => api.post("/auth/student/verify", data),
  studentLogin: (data) => api.post("/auth/student/login", data),
};
