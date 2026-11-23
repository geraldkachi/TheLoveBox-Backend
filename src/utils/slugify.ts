export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const uniqueSlug = (s: string) => `${slugify(s)}-${Date.now().toString(36)}`;

/** Escape user input before using it inside a RegExp (prevents ReDoS / regex injection). */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
