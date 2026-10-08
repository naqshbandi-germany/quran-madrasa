// Google-Anmeldung ist nur aktiv, wenn die OAuth-Zugangsdaten gesetzt sind (siehe README).
// Wird erst beim Aufruf gelesen, damit der Build auch ohne diese Variablen funktioniert.
export function isGoogleAuthConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim());
}
