import { env } from "../config/env.js";
export class EmailDeliveryError extends Error {
  constructor(message, { status, code, emailInvalid = false, userMessage } = {}) {
    super(message);
    this.name = "EmailDeliveryError";
    this.status = status;
    this.code = code;
    this.emailInvalid = emailInvalid;
    this.userMessage = userMessage;
  }
}
export async function sendEmail({ to, subject, html, text }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    console.warn("Email not sent: configure RESEND_API_KEY and EMAIL_FROM.");
    return { sent: false, reason: "not_configured" };
  }
  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }),
    });
  } catch (error) {
    throw new EmailDeliveryError("Could not connect to the email provider.", { code: "network_error", userMessage: "Could not reach Resend. Check the server network connection and try again." });
  }
  if (!response.ok) {
    let details = {};
    try { details = await response.json(); } catch {}
    const providerMessage = String(details.message || details.error || "Email provider rejected the message.");
    const code = String(details.name || details.code || "");
    const emailInvalid = /invalid.*email|email.*invalid|recipient.*invalid|does not exist|suppression|cannot receive/i.test(`${code} ${providerMessage}`);
    let userMessage = "Resend rejected the email request. Check the Resend logs and sender configuration.";
    if (response.status === 401) userMessage = "Resend rejected the API key. Check RESEND_API_KEY.";
    else if (response.status === 403) {
      const unauthorizedDomain = providerMessage.match(/send emails? from\s+([a-z\d.-]+\.[a-z]{2,})/i)?.[1];
      userMessage = unauthorizedDomain
        ? `Resend does not authorize sending from ${unauthorizedDomain}. Verify a domain you own in Resend, then set EMAIL_FROM to an address on that domain in the server environment.`
        : "Resend rejected the sender. Verify a domain you own in Resend and set EMAIL_FROM to an address on that domain in the server environment.";
    }
    else if (response.status === 429) userMessage = "Resend is temporarily rate-limiting email. Please try again shortly.";
    else if (response.status >= 500) userMessage = "Resend is temporarily unavailable. Please try again shortly.";
    else if (emailInvalid) userMessage = "Email does not exist or cannot receive emails.";
    throw new EmailDeliveryError(providerMessage, { status: response.status, code, emailInvalid, userMessage });
  }
  let data = {};
  try { data = await response.json(); } catch {}
  return { sent: true, id: data.id };
}
export async function notifyAdmin(subject, text) {
  if (!env.MASTER_ADMIN_EMAIL) return { sent: false, reason: "not_configured" };
  return sendEmail({ to: env.MASTER_ADMIN_EMAIL, subject, text });
}
