import { auth } from "@/auth";
import { ConfirmButton } from "@/components/confirm-button";
import { DownloadIcon, FileIcon, TrashIcon } from "@/components/icons";
import { blobAccess, isBlobConfigured } from "@/lib/blob";
import { ALLOWED_EXTENSIONS, MAX_BLOB_FILE_BYTES, MAX_FILE_BYTES, formatBytes } from "@/lib/media";
import { deleteMediaFile } from "@/lib/media-actions";
import { prisma } from "@/lib/prisma";
import { UploadForm } from "./upload-form";

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
      sizeBytes: true,
      createdAt: true,
      owner: { select: { name: true } },
    },
  });

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
          Deine Dateien ({files.length})
        </h2>
        {files.length === 0 ? (
          <p className="text-sm text-brand-600">Noch keine Dateien hochgeladen.</p>
        ) : (
          <ul className="divide-y divide-brand-100 rounded-lg border border-brand-200 bg-white text-sm">
            {files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
                <FileIcon className="h-5 w-5 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-brand-900">{file.title}</p>
                  <p className="truncate text-brand-600">
                    {file.fileName} · {formatBytes(file.sizeBytes)} ·{" "}
                    {new Intl.DateTimeFormat("de-DE").format(file.createdAt)}
                    {isAdmin ? ` · von ${file.owner.name}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <a
                    href={`/api/media/${file.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md font-medium text-azure-800 hover:text-azure-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700"
                  >
                    <DownloadIcon />
                    Herunterladen
                  </a>
                  <form action={deleteMediaFile}>
                    <input type="hidden" name="fileId" value={file.id} />
                    <ConfirmButton
                      message={`„${file.title}“ wirklich aus der Mediathek entfernen?`}
                      className="inline-flex items-center gap-1.5 rounded-md font-medium text-red-800 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    >
                      <TrashIcon />
                      Entfernen
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
