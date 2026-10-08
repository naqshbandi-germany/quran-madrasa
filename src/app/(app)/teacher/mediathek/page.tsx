import { auth } from "@/auth";
import { MediaBrowser } from "@/components/media-browser";
import { UploadForm } from "@/components/media-upload-form";
import { blobAccess, isBlobConfigured } from "@/lib/blob";
import { ALLOWED_EXTENSIONS, MAX_BLOB_FILE_BYTES, MAX_FILE_BYTES, formatBytes } from "@/lib/media";
import { toMediaItem } from "@/lib/media-items";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Mediathek – Quran Madrasa" };
export const dynamic = "force-dynamic";

export default async function MediaLibraryPage() {
  const session = await auth();
  if (!session) return null;
  const isAdmin = session.user.role === "ADMIN";
  const blobEnabled = isBlobConfigured();

  // Den Dateiinhalt ("data") nie fuer die Liste laden.
  const files = await prisma.mediaFile.findMany({
    where: isAdmin ? {} : { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      blobPathname: true,
      owner: { select: { name: true } },
    },
  });
  const items = files.map((file) => toMediaItem({ ...file, owner: isAdmin ? file.owner : null }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">Mediathek</h1>
        <p className="mt-1 text-sm text-brand-600">
          Hier legst du Lehrmaterial ab (z. B. Arbeitsblätter als PDF). Beim Versand einer E-Mail an
          deine Kursteilnehmer wählst du die Dateien als Anhang aus.
        </p>
      </div>

      <section aria-labelledby="hochladen" className="space-y-3">
        <h2 id="hochladen" className="font-semibold text-brand-700">
          Datei hochladen
        </h2>
        <UploadForm blobEnabled={blobEnabled} blobAccess={blobAccess()} userId={session.user.id} />
        <p className="text-xs text-brand-600">
          Erlaubt sind {ALLOWED_EXTENSIONS.join(", ")} bis {formatBytes(blobEnabled ? MAX_BLOB_FILE_BYTES : MAX_FILE_BYTES)} je Datei.
          {!blobEnabled && " Für größere Dateien muss der Blob-Speicher eingerichtet werden (siehe README)."}
        </p>
      </section>

      <section aria-labelledby="dateien" className="space-y-3">
        <h2 id="dateien" className="font-semibold text-brand-700">
          {isAdmin ? "Alle Dateien" : "Deine Dateien"} ({items.length})
        </h2>
        <MediaBrowser items={items} mode="manage" />
      </section>
    </div>
  );
}
