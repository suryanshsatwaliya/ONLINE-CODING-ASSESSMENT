import axios from "axios";
const apiRoot = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
// Keep production admin requests on the frontend origin. The Vercel function at
// /api/[...path] proxies them to Render, so browsers do not have to accept a
// third-party Render cookie while the user is on the Vercel/custom frontend.
const adminApiRoot = import.meta.env.PROD ? "/api" : apiRoot;
const api = axios.create({ baseURL: `${adminApiRoot}/master-admin`, timeout: 30000, withCredentials: true });
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
