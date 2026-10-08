// Weiterleitungsziele nach dem Login (callbackUrl) duerfen nur seiteninterne Pfade sein,
// sonst koennte ein praeparierter Link Nutzer nach der Anmeldung auf fremde Seiten schicken.
export function safeCallbackUrl(value: string | null | undefined, fallback = "/dashboard") {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
