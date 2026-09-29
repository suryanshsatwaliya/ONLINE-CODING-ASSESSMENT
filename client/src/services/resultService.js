import { api } from "./api";
export const resultService = {
  list: (id) => api.get("/results/" + id),
  mine: (id) => api.get("/results/mine/" + id),
};
