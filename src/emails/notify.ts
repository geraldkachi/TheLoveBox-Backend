import { sendMail } from "./mailer";
import { orderReceivedEmail, orderStatusEmail, shippingQuoteEmail, shippingPaidEmail, adminNewOrderEmail } from "./templates";

const adminRecipients = () =>
  (process.env.ADMIN_NOTIFY_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const replyTo = () => process.env.SUPPORT_EMAIL || undefined;

export async function notifyOrderPaid(order: any) {
  const jobs = [sendMail({ to: order.customer.email, replyTo: replyTo(), ...orderReceivedEmail(order) })];
  const admins = adminRecipients();
  if (admins.length) jobs.push(sendMail({ to: admins, replyTo: order.customer.email, ...adminNewOrderEmail(order) }));
  await Promise.allSettled(jobs);
}

export async function notifyStatus(order: any, status: string, note?: string) {
  const mail = orderStatusEmail(order, status, note);
  if (!mail) return { sent: false, error: "NO_TEMPLATE" };
  return sendMail({ to: order.customer.email, replyTo: replyTo(), ...mail });
}

export const notifyShippingQuote = (order: any) => sendMail({ to: order.customer.email, replyTo: replyTo(), ...shippingQuoteEmail(order) });
export const notifyShippingPaid = (order: any) => sendMail({ to: order.customer.email, replyTo: replyTo(), ...shippingPaidEmail(order) });
