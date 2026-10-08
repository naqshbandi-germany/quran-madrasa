// Regeln fuer die Mediathek (Upload, Anhang an E-Mails).

// Ohne Blob-Speicher liegen Dateien in der Datenbank. Vercel nimmt pro Anfrage hoechstens
// ca. 4,5 MB an, daher die Obergrenze je Datei.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
// Mit Vercel Blob geht der Upload direkt vom Browser in den Speicher.
export const MAX_BLOB_FILE_BYTES = 200 * 1024 * 1024;
// Bis zu dieser Groesse haengen wir Blob-Dateien an die E-Mail an, groessere gehen als Link.
export const ATTACH_MAX_BYTES = 5 * 1024 * 1024;
// Download-Links in E-Mails sind so viele Tage gueltig.
export const LINK_VALID_DAYS = 90;
// Gesamtgroesse aller Anhaenge einer E-Mail (viele Postfaecher lehnen groessere Mails ab).
export const MAX_ATTACHMENT_TOTAL_BYTES = 10 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp3: "audio/mpeg",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED);
export const ALLOWED_MIME_TYPES = [...new Set(Object.values(ALLOWED))];

// Dateien im Blob-Speicher ueber ATTACH_MAX_BYTES werden als Link statt als Anhang verschickt.
export function shouldSendAsLink(file: { blobPathname: string | null; sizeBytes: number }) {
  return Boolean(file.blobPathname) && file.sizeBytes > ATTACH_MAX_BYTES;
}

export function extensionOf(fileName: string) {
  const match = /\.([A-Za-z0-9]{2,5})$/.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

// Gibt den Mime-Typ zurueck oder null, wenn die Dateiendung nicht erlaubt ist.
export function mimeTypeFor(fileName: string) {
  return ALLOWED[extensionOf(fileName)] ?? null;
}

// Bereinigt einen Dateinamen fuer Download und Anhang (keine Pfade, keine Sonderzeichen).
export function safeFileName(fileName: string) {
  const base = fileName.split(/[\\/]/).pop() ?? "datei";
  const cleaned = base.replace(/[^A-Za-z0-9._ äöüÄÖÜß()-]/g, "_").replace(/\s+/g, " ").trim();
  return cleaned.slice(-120) || "datei";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
