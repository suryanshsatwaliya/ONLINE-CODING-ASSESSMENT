import { env } from "../config/env.js";
export async function sendEmail({ to, subject, html, text }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    console.warn("Email not sent: configure RESEND_API_KEY and EMAIL_FROM.");
    return { sent: false, reason: "not_configured" };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }),
  });
  if (!response.ok) throw new Error("Email provider rejected the message.");
  return { sent: true };
}
export async function notifyAdmin(subject, text) {
  if (!env.MASTER_ADMIN_EMAIL) return { sent: false, reason: "not_configured" };
  return sendEmail({ to: env.MASTER_ADMIN_EMAIL, subject, text });
}
