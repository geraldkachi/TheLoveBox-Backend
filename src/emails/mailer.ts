import { logger } from "../utils/logger";

export interface MailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tag?: string;
}

/**
 * Sends through Mailgun's HTTP API (no SDK needed).
 * Env: MAILGUN_API_KEY, MAILGUN_DOMAIN, MAIL_FROM, optional MAILGUN_REGION=eu.
 * Never throws — an email failure must not break checkout or an admin action.
 */
export async function sendMail(input: MailInput): Promise<{ sent: boolean; id?: string; error?: string }> {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!key || !domain) {
    logger.warn("Mailgun not configured — email skipped", { subject: input.subject, to: input.to });
    return { sent: false, error: "MAILGUN_NOT_CONFIGURED" };
  }

  const base = process.env.MAILGUN_API_BASE || (process.env.MAILGUN_REGION === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net");
  const from = process.env.MAIL_FROM || `The Love Box <orders@${domain}>`;
  const body = new URLSearchParams();
  body.append("from", from);
  for (const to of Array.isArray(input.to) ? input.to : [input.to]) body.append("to", to);
  body.append("subject", input.subject);
  body.append("html", input.html);
  body.append("text", input.text || input.html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  if (input.replyTo) body.append("h:Reply-To", input.replyTo);
  if (input.tag) body.append("o:tag", input.tag);
  if (process.env.MAILGUN_TEST_MODE === "true") body.append("o:testmode", "yes");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${base}/v3/${domain}/messages`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`api:${key}`).toString("base64") },
      body,
      signal: controller.signal,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.error("Mailgun rejected email", { status: res.status, message: data?.message, subject: input.subject });
      return { sent: false, error: data?.message || `HTTP ${res.status}` };
    }
    logger.info("Email sent", { id: data.id, subject: input.subject, tag: input.tag });
    return { sent: true, id: data.id };
  } catch (e: any) {
    logger.error("Mailgun request failed", { error: e?.message, subject: input.subject });
    return { sent: false, error: e?.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Fire-and-forget helper for request handlers. */
export const sendMailLater = (input: MailInput) => {
  void sendMail(input);
};
