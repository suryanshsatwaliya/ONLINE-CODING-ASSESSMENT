import { api } from "./api";
export const proctorService = {
  send: (data) => api.post("/proctor/events", data, { timeout: 8000 }),
};
