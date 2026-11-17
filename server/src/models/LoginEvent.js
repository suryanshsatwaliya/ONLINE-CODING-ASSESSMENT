import { model } from "./shared.js";
export default model("LoginEvent", { userType: String, userId: String, email: String, outcome: String, ip: String, userAgent: String }, [[{ createdAt: -1 }, {}], [{ userType: 1, createdAt: -1 }, {}]]);
