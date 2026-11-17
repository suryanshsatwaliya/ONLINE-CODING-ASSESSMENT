import axios from "axios";
const apiRoot = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
const api = axios.create({ baseURL: `${apiRoot}/master-admin`, timeout: 30000, withCredentials: true });
let csrfToken = "";
let adminRouteId = "";
export const setAdminCsrfToken = (value = "") => { csrfToken = value; };
export const setAdminRouteId = (value = "") => { adminRouteId = value; };
api.interceptors.request.use((config) => {
  config.headers["X-Admin-Entry"] = window.location.pathname;
  if (adminRouteId) config.headers["X-Admin-Route"] = adminRouteId;
  if (csrfToken && !["get", "head", "options"].includes(config.method?.toLowerCase())) config.headers["X-CSRF-Token"] = csrfToken;
  return config;
});
export const adminApi = api;
