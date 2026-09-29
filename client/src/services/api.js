import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 120000,
});
api.interceptors.request.use((c) => {
  const token = sessionStorage.getItem("token");
  if (token) c.headers.Authorization = "Bearer " + token;
  return c;
});
export const errorMessage = (e) =>
  e.response?.data?.errors?.[0]?.message ||
  e.response?.data?.message ||
  e.message ||
  "Request failed";
