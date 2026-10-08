import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { blobPathPrefix } from "@/lib/blob";
import { ALLOWED_MIME_TYPES, MAX_BLOB_FILE_BYTES, mimeTypeFor } from "@/lib/media";

// Gibt dem Browser eine einmalige Erlaubnis, eine Datei direkt in den Blob-Speicher zu laden.
// Nur Lehrer und Admins, nur im eigenen Ordner, nur erlaubte Dateitypen und Groessen.
// (Vercel ruft diese Adresse nach dem Upload ausserdem selbst auf; das prueft handleUpload.)
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  const session = await auth();

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
          throw new Error("Nicht berechtigt.");
        }
        if (!pathname.startsWith(blobPathPrefix(session.user.id))) throw new Error("Ungültiger Pfad.");
        if (!mimeTypeFor(pathname)) throw new Error("Dieser Dateityp ist nicht erlaubt.");
        return {
          allowedContentTypes: ALLOWED_MIME_TYPES,
          maximumSizeInBytes: MAX_BLOB_FILE_BYTES,
          addRandomSuffix: true,
        };
      },
      // Die Datei wird nach dem Upload ueber die Server-Aktion registerBlobFile eingetragen.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
