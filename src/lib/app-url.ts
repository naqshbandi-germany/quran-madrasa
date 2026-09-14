// "||" statt "??": eine leer gesetzte NEXT_PUBLIC_APP_URL (z.B. versehentlich
// mit leerem Wert gespeichert) soll ebenfalls auf den Fallback zurückfallen,
// nicht nur ein fehlendes/undefined env var.
export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
