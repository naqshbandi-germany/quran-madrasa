import { del, get } from "@vercel/blob";

// Vercel Blob ist aktiv, sobald der Speicher in Vercel angelegt und BLOB_READ_WRITE_TOKEN
// gesetzt ist (siehe README). Sonst liegen Mediathek-Dateien in der Datenbank.
export function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

// "private": Dateien sind nicht oeffentlich abrufbar, sondern nur ueber unsere Seite
// (Anmeldung bzw. befristeter Link). Muss zur Art des Blob-Speichers in Vercel passen; fuer
// einen oeffentlichen Speicher BLOB_ACCESS=public setzen.
export function blobAccess(): "public" | "private" {
  return process.env.BLOB_ACCESS?.trim().toLowerCase() === "public" ? "public" : "private";
}

export function blobPathPrefix(userId: string) {
  return `media/${userId}/`;
}

export async function deleteBlob(pathname: string) {
  try {
    await del(pathname);
  } catch (err) {
    console.error(`Blob ${pathname} konnte nicht geloescht werden:`, err);
  }
}

export async function openBlob(pathname: string) {
  return get(pathname, { access: blobAccess() });
}
