import { emailTheme as t } from "./theme";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const naira = (n: number) => "₦" + (Number(n) || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const longDate = (d: Date | string) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
const firstName = (name: string) => esc((name || "there").trim().split(/\s+/)[0]);

/* ---------- layout ---------- */
function button(href: string, label: string, variant: "primary" | "accent" = "primary") {
  const bg = variant === "primary" ? t.primary : t.accent;
  const color = variant === "primary" ? "#ffffff" : t.ink;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:999px;background:${bg}">
    <a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-weight:600;font-size:15px;color:${color};text-decoration:none;border-radius:999px">${esc(label)}</a>
  </td></tr></table>`;
}

function layout(opts: { preheader: string; heading: string; body: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:${t.soft};font-family:Helvetica,Arial,sans-serif;color:${t.ink}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.soft};padding:28px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">
    <tr><td style="height:6px;background:${t.primary};font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:32px 36px 8px">
      <a href="${esc(t.siteUrl)}"><img src="${esc(t.logoUrl)}" alt="${esc(t.brandName)}" width="150" style="display:block;border:0;width:150px;height:auto"></a>
    </td></tr>
    <tr><td style="padding:12px 36px 32px">
      <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-0.5px;color:${t.ink}">${esc(opts.heading)}</h1>
      ${opts.body}
    </td></tr>
    <tr><td style="padding:22px 36px;background:${t.soft};font-size:13px;line-height:1.6;color:${t.muted}">
      Questions about your gift? Reply to this email or write to <a href="mailto:${esc(t.supportEmail)}" style="color:${t.primary}">${esc(t.supportEmail)}</a>${t.whatsapp ? `, or <a href="https://wa.me/${esc(t.whatsapp)}" style="color:${t.primary}">chat with us on WhatsApp</a>` : ""}.<br>
      ${esc(t.brandName)} · 206 Borno Way, Adekunle, Yaba, Lagos
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${t.ink}">${html}</p>`;

/* ---------- order blocks ---------- */
function itemsTable(order: any) {
  const rows = (order.items || [])
    .map((it: any) => {
      const comps =
        it.kind === "custom" && it.components?.length
          ? `<div style="margin-top:4px;font-size:12.5px;line-height:1.5;color:${t.muted}">${it.components
              .filter((c: any) => c.step !== "box")
              .map((c: any) => `${esc(c.name)}${c.qty > 1 ? ` ×${c.qty}` : ""}`)
              .join(", ")}</div>`
          : it.size && it.size !== "Standard"
          ? `<div style="margin-top:2px;font-size:12.5px;color:${t.muted}">${esc(it.size)}</div>`
          : "";
      return `<tr>
        <td width="64" style="padding:12px 12px 12px 0;vertical-align:top">${it.image ? `<img src="${esc(it.image)}" width="56" height="56" alt="" style="display:block;border-radius:10px;object-fit:cover;background:${t.soft}">` : ""}</td>
        <td style="padding:12px 8px 12px 0;vertical-align:top;font-size:14.5px;line-height:1.4">${esc(it.name)}${comps}</td>
        <td style="padding:12px 8px;vertical-align:top;font-size:14px;color:${t.muted};white-space:nowrap">×${it.qty}</td>
        <td style="padding:12px 0;vertical-align:top;font-size:14.5px;text-align:right;white-space:nowrap">${naira(it.price * it.qty)}</td>
      </tr>`;
    })
    .join("");

  const shippingCell =
    order.shipping?.status === "paid" || order.shipping?.status === "awaiting_payment"
      ? naira(order.shipping.fee || 0) + (order.shipping.status === "paid" ? " (paid)" : " (awaiting payment)")
      : order.shipping?.status === "waived"
      ? "Free"
      : "Shipment fee will be communicated after order confirmation";

  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:${bold ? t.ink : t.muted};${bold ? "font-weight:700" : ""}">${label}</td><td style="padding:6px 0;font-size:14px;text-align:right;${bold ? "font-weight:700;font-size:16px" : ""}">${value}</td></tr>`;

  return `
  <h2 style="margin:26px 0 2px;font-size:18px;font-weight:700">Order summary</h2>
  <p style="margin:0 0 8px;font-size:13.5px;color:${t.muted}">Order #${esc(order.orderNumber)} (${longDate(order.createdAt || new Date())})</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${t.line};border-bottom:1px solid ${t.line}">${rows}</table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">
    ${line("Subtotal", naira(order.subtotal))}
    ${order.discount ? line(`Discount${order.promoCode ? ` (${esc(order.promoCode)})` : ""}`, "−" + naira(order.discount)) : ""}
    ${line("Shipping", esc(shippingCell))}
    ${line("Total paid", naira(order.total), true)}
    ${line("Payment method", "Paystack")}
  </table>`;
}

function addressBlock(order: any) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid ${t.line}"><tr>
    <td style="padding-top:18px;vertical-align:top;font-size:14px;line-height:1.6;width:50%">
      <strong>Delivery address</strong><br>${esc(order.deliveryAddress).replace(/\n/g, "<br>")}
      ${order.deliveryDate ? `<br><span style="color:${t.muted}">Delivery date: ${longDate(order.deliveryDate)}</span>` : ""}
    </td>
    <td style="padding-top:18px;vertical-align:top;font-size:14px;line-height:1.6">
      <strong>Contact</strong><br>${esc(order.customer?.name)}<br>${esc(order.customer?.phone)}<br>${esc(order.customer?.email)}
    </td></tr></table>
    ${order.giftMessage ? `<div style="margin-top:20px;padding:16px 18px;border:1px dashed ${t.accent};border-radius:12px;font-size:14.5px;line-height:1.6"><strong style="color:${t.primary}">Card message</strong><br>${esc(order.giftMessage)}</div>` : ""}`;
}

const trackUrl = (order: any) => `${t.siteUrl}/track-order?order=${encodeURIComponent(order.orderNumber)}`;

/* ---------- emails ---------- */
export function orderReceivedEmail(order: any) {
  return {
    subject: `Your ${t.brandName} order has been received! (#${order.orderNumber})`,
    html: layout({
      preheader: `We've received your order ${order.orderNumber} and it's now being processed.`,
      heading: "Thank you for your order",
      body:
        p(`Hi ${firstName(order.customer?.name)},`) +
        p("Just to let you know — we've received your order, and it is now being processed.") +
        p(`<strong>Shipping:</strong> our team will confirm your delivery fee shortly and send it to you by email with a secure payment link.`) +
        itemsTable(order) +
        addressBlock(order) +
        button(trackUrl(order), "Track your order"),
    }),
    tag: "order-received",
  };
}

const STATUS_COPY: Record<string, { subject: string; heading: string; lead: string }> = {
  processing: { subject: "We're preparing your gift", heading: "Your gift is being styled", lead: "Our studio team has started putting your order together." },
  out_for_delivery: { subject: "is on its way!", heading: "Good things are heading your way!", lead: "We have finished processing your order and it's now out for delivery." },
  delivered: { subject: "has been delivered", heading: "Delivered with love", lead: "Your order has been delivered. We hope it made someone's day." },
  cancelled: { subject: "has been cancelled", heading: "Your order was cancelled", lead: "Your order has been cancelled. If this is unexpected, please reply to this email and we'll help straight away." },
};

export function orderStatusEmail(order: any, status: string, note?: string) {
  const c = STATUS_COPY[status];
  if (!c) return null;
  const subject = status === "processing" ? `${c.subject} (#${order.orderNumber})` : `Your order from ${t.brandName} ${c.subject}`;
  return {
    subject,
    html: layout({
      preheader: c.lead,
      heading: c.heading,
      body:
        p(`Hi ${firstName(order.customer?.name)},`) +
        p(c.lead) +
        (note ? p(`<em style="color:${t.muted}">${esc(note)}</em>`) : "") +
        p("Here's a reminder of what you've ordered:") +
        itemsTable(order) +
        addressBlock(order) +
        (status !== "cancelled" ? button(trackUrl(order), "Track your order") : ""),
    }),
    tag: `order-${status}`,
  };
}

export function shippingQuoteEmail(order: any) {
  const fee = order.shipping?.fee || 0;
  const pay = order.shipping?.paymentUrl;
  return {
    subject: `Shipping fee for your order #${order.orderNumber}`,
    html: layout({
      preheader: `Your delivery fee is ${naira(fee)}.`,
      heading: "Your shipping fee is ready",
      body:
        p(`Hi ${firstName(order.customer?.name)},`) +
        p(`We've confirmed delivery for order <strong>#${esc(order.orderNumber)}</strong> to:<br><span style="color:${t.muted}">${esc(order.deliveryAddress)}</span>`) +
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;background:${t.soft};border-radius:14px;width:100%"><tr><td style="padding:20px 22px">
          <div style="font-size:13px;color:${t.muted}">Shipping fee</div>
          <div style="font-size:30px;font-weight:800;letter-spacing:-0.5px">${naira(fee)}</div>
          ${order.shipping?.note ? `<div style="margin-top:6px;font-size:13.5px;color:${t.muted}">${esc(order.shipping.note)}</div>` : ""}
        </td></tr></table>` +
        (pay ? button(pay, `Pay ${naira(fee)} securely`) + p(`<span style="font-size:13px;color:${t.muted}">The button opens Paystack. Your gift goes out as soon as shipping is paid.</span>`) : p("Reply to this email and we'll share payment details.")),
    }),
    tag: "shipping-quote",
  };
}

export function shippingPaidEmail(order: any) {
  return {
    subject: `Shipping paid — order #${order.orderNumber}`,
    html: layout({
      preheader: "We've received your shipping payment.",
      heading: "Shipping payment received",
      body: p(`Hi ${firstName(order.customer?.name)},`) + p(`Thanks — we've received ${naira(order.shipping?.fee || 0)} for delivery. We'll let you know the moment your gift is on its way.`) + button(trackUrl(order), "Track your order"),
    }),
    tag: "shipping-paid",
  };
}

export function adminNewOrderEmail(order: any) {
  const admin = (process.env.ADMIN_APP_URL || "").split(",")[0].trim().replace(/\/$/, "");
  return {
    subject: `New paid order ${order.orderNumber} — ${naira(order.total)}`,
    html: layout({
      preheader: `${order.customer?.name} just paid ${naira(order.total)}.`,
      heading: "New order to prepare",
      body: p(`<strong>${esc(order.customer?.name)}</strong> just paid for order #${esc(order.orderNumber)}. Set the shipping fee so the customer can pay for delivery.`) + itemsTable(order) + addressBlock(order) + (admin ? button(`${admin}/orders`, "Open in Studio") : ""),
    }),
    tag: "admin-new-order",
  };
}

export function contactAckEmail(name: string) {
  return {
    subject: `We've got your message — ${t.brandName}`,
    html: layout({ preheader: "We usually reply within the hour.", heading: "Thanks for reaching out", body: p(`Hi ${firstName(name)},`) + p("Your message is with our team. We usually reply within the hour, 8am to 8pm.") + button(`${t.siteUrl}/categories`, "Browse gifts while you wait") }),
    tag: "contact-ack",
  };
}

export function adminContactEmail(inq: { name: string; email: string; phone?: string; message: string }) {
  return {
    subject: `New message from ${inq.name}`,
    html: layout({ preheader: inq.message.slice(0, 90), heading: "New contact message", body: p(`<strong>${esc(inq.name)}</strong> · ${esc(inq.email)}${inq.phone ? ` · ${esc(inq.phone)}` : ""}`) + p(esc(inq.message).replace(/\n/g, "<br>")) }),
    tag: "admin-contact",
  };
}

export function welcomeEmail(discount?: { code: string; label: string; minSubtotal?: number } | null) {
  return {
    subject: discount ? `Here's your ${discount.label} code` : `Welcome to ${t.brandName}`,
    html: layout({
      preheader: discount ? `Use ${discount.code} at checkout.` : "Gift ideas before every big occasion.",
      heading: discount ? `Your ${discount.label} is here` : "You're on the list",
      body:
        p("Thanks for joining. We'll send gifting ideas before each big occasion — never spam.") +
        (discount
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td style="padding:16px 26px;border:2px dashed ${t.accent};border-radius:14px;font-size:26px;font-weight:800;letter-spacing:3px;color:${t.primary}">${esc(discount.code)}</td></tr></table>` +
            p(`Enter it at checkout for ${esc(discount.label)}${discount.minSubtotal ? ` on orders over ${naira(discount.minSubtotal)}` : ""}.`)
          : "") +
        button(`${t.siteUrl}/curate`, "Curate a gift box"),
    }),
    tag: "welcome",
  };
}
