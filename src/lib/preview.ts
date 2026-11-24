// Vorschau-Modus der Website (siehe src/proxy.ts): Cookie der Freigabe und der Zugangscode.
export const PREVIEW_COOKIE = "vorschau";

export function previewCode() {
  return process.env.SITE_PREVIEW_CODE?.trim() || null;
}
