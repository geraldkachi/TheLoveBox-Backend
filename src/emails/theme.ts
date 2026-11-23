/**
 * Email brand settings. Change colours here (or via env) — emails can't read
 * the website's CSS file, so they keep their own copy of the palette.
 */
export const emailTheme = {
  primary: process.env.EMAIL_PRIMARY_COLOR || "#7A1F3A", // burgundy
  accent: process.env.EMAIL_ACCENT_COLOR || "#C9A961", // champagne gold
  soft: process.env.EMAIL_SOFT_COLOR || "#F6F0E4", // champagne cream
  ink: "#24161B",
  muted: "#7A6B70",
  line: "#ECE4D8",
  brandName: process.env.BRAND_NAME || "The Love Box",
  get siteUrl() {
    return (process.env.CUSTOMER_APP_URL || "").split(",")[0].trim().replace(/\/$/, "") || "https://the-love-box-customer.vercel.app";
  },
  get logoUrl() {
    return process.env.EMAIL_LOGO_URL || `${this.siteUrl}/brand/logo-email.png`;
  },
  get supportEmail() {
    return process.env.SUPPORT_EMAIL || "info@theloveboxgifts.com";
  },
  get whatsapp() {
    return process.env.WHATSAPP_SALES_NUMBER || "";
  },
};
