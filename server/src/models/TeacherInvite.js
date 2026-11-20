import { model } from "./shared.js";
export default model("TeacherInvite", {
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  username: { type: String, required: true, lowercase: true, trim: true, unique: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, []);
