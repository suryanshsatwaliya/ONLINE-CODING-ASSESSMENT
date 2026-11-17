import { model } from "./shared.js";
export default model("MasterAdmin", {
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  totpSecretEncrypted: { type: String, select: false },
  totpEnabled: { type: Boolean, default: false },
  pendingTotpEncrypted: { type: String, select: false },
  recoveryCodeHashes: { type: [String], default: [], select: false },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: Date,
  lastLogin: Date,
}, []);
