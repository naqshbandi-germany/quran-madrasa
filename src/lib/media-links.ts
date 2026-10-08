import { createHmac, timingSafeEqual } from "node:crypto";

import { LINK_VALID_DAYS } from "@/lib/media";

function secret() {
  const value = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET ist nicht gesetzt.");
  return value;
}

function signature(fileId: string, expires: number) {
  return createHmac("sha256", secret()).update(`media:${fileId}:${expires}`).digest("hex");
}

// Befristeter Download-Pfad fuer E-Mails: gilt ohne Anmeldung, ist aber ohne die Signatur nicht
// erratbar und laeuft ab.
export function signedMediaPath(fileId: string, now: number = Date.now()) {
  const expires = Math.floor(now / 1000) + LINK_VALID_DAYS * 24 * 60 * 60;
  return `/api/media/shared/${fileId}?e=${expires}&s=${signature(fileId, expires)}`;
}

export function verifyMediaLink(fileId: string, expires: string | null, sig: string | null, now: number = Date.now()) {
  const exp = Number(expires);
  if (!sig || !Number.isInteger(exp) || exp < Math.floor(now / 1000)) return false;
  const expected = Buffer.from(signature(fileId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
