"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ConfirmButton } from "@/components/confirm-button";
import {
  DownloadIcon,
  FileIcon,
  GridIcon,
  ImageIcon,
  ListIcon,
  MusicIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { formatBytes } from "@/lib/media";
import { deleteMediaFile } from "@/lib/media-actions";
import { MEDIA_KIND_LABELS, mediaKindOf, type MediaItem, type MediaKind } from "@/lib/media-items";

// --- Ansicht (Raster oder Liste) wird im Browser gemerkt -------------------------------------
type View = "grid" | "list";

function subscribeView(callback: () => void) {
  window.addEventListener("media-view", callback);
  return () => window.removeEventListener("media-view", callback);
}

function readView(): View {
  try {
    return localStorage.getItem("mediaView") === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function useView(): [View, (view: View) => void] {
  const view = useSyncExternalStore(subscribeView, readView, () => "grid" as View);
  function setView(next: View) {
    try {
      localStorage.setItem("mediaView", next);
    } catch {
      /* Speichern ist nur eine Annehmlichkeit */
    }
    window.dispatchEvent(new Event("media-view"));
  }
  return [view, setView];
}

const FILTERS: { value: "all" | MediaKind; label: string }[] = [
  { value: "all", label: "Alle Dateien" },
  { value: "image", label: "Bilder" },
  { value: "pdf", label: "PDF" },
  { value: "audio", label: "Audio" },
  { value: "doc", label: "Dokumente" },
];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-DE").format(new Date(iso));
}

function extensionLabel(fileName: string) {
  return (fileName.split(".").pop() ?? "").toUpperCase().slice(0, 4);
}

// Vorschaubild bzw. Symbol einer Datei. Bilder laden ein verkleinertes Vorschaubild; schlaegt das
// fehl (zu gross, Format), erscheint das Symbol.
function Thumb({ item, large = false }: { item: MediaItem; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const kind = mediaKindOf(item.mimeType);

  if (kind === "image" && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/media/${item.id}/thumb`}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  }

  const Icon = kind === "image" ? ImageIcon : kind === "audio" ? MusicIcon : FileIcon;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-brand-50 text-brand-600">
      <Icon className={large ? "h-10 w-10" : "h-5 w-5"} />
      {large && (
        <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold tracking-wide text-brand-700">
          {extensionLabel(item.fileName)}
        </span>
      )}
    </div>
  );
}

// Grosse Vorschau in einem Dialog (Bild, PDF, Audio); andere Dateien koennen heruntergeladen werden.
function PreviewDialog({
  item,
  mode,
  selected,
  onToggle,
  onClose,
}: {
  item: MediaItem;
  mode: "manage" | "select";
  selected: boolean;
  onToggle?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const kind = mediaKindOf(item.mimeType);
  const inlineUrl = `/api/media/${item.id}?inline=1`;

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-label={`Vorschau: ${item.title}`}
      className="m-auto w-[min(56rem,94vw)] rounded-lg border border-brand-200 bg-white p-0 shadow-xl backdrop:bg-black/60"
    >
      <div className="flex items-start justify-between gap-4 border-b border-brand-100 px-5 py-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-brand-900">{item.title}</h3>
          <p className="truncate text-sm text-brand-600">
            {item.fileName} · {MEDIA_KIND_LABELS[kind]} · {formatBytes(item.sizeBytes)} · {formatDate(item.createdAt)}
            {item.ownerName ? ` · von ${item.ownerName}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Vorschau schließen"
          className="rounded-md p-1.5 text-brand-700 hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-azure-700"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex max-h-[70vh] min-h-[16rem] items-center justify-center overflow-auto bg-brand-50 p-3">
        {kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={inlineUrl} alt={item.title} className="max-h-[66vh] max-w-full object-contain" />
        )}
        {kind === "pdf" && (
          <iframe title={`Vorschau: ${item.title}`} src={inlineUrl} className="h-[66vh] w-full rounded bg-white" />
        )}
        {kind === "audio" && <audio controls src={inlineUrl} className="w-full max-w-lg" />}
        {kind === "doc" && (
          <p className="max-w-sm text-center text-sm text-brand-700">
            Für diesen Dateityp gibt es keine Vorschau. Du kannst die Datei herunterladen und öffnen.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 px-5 py-3 text-sm">
        <a
          href={`/api/media/${item.id}`}
          className="inline-flex items-center gap-1.5 rounded-md font-medium text-azure-800 hover:text-azure-700"
        >
          <DownloadIcon />
          Herunterladen
        </a>
        {mode === "select" ? (
          <button
            type="button"
            onClick={() => {
              onToggle?.();
              onClose();
            }}
            className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            {selected ? "Auswahl aufheben" : "Auswählen"}
          </button>
        ) : (
          <form action={deleteMediaFile}>
            <input type="hidden" name="fileId" value={item.id} />
            <ConfirmButton
              message={`„${item.title}“ wirklich aus der Mediathek entfernen?`}
              className="inline-flex items-center gap-1.5 rounded-md font-medium text-red-800 hover:text-red-700"
            >
              <TrashIcon />
              Entfernen
            </ConfirmButton>
          </form>
        )}
      </div>
    </dialog>
  );
}

// Mediathek-Ansicht im Stil von WordPress: Raster mit Vorschaubildern oder Liste, Suche und
// Filter nach Dateityp. Im Modus "select" (E-Mail-Anhaenge) werden Dateien per Klick ausgewaehlt,
// im Modus "manage" oeffnet ein Klick die Vorschau.
export function MediaBrowser({
  items,
  mode,
  selected,
  onToggle,
}: {
  items: MediaItem[];
  mode: "manage" | "select";
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const [view, setView] = useView();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MediaKind>("all");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = items.filter(
    (item) =>
      (filter === "all" || mediaKindOf(item.mimeType) === filter) &&
      (!needle || `${item.title} ${item.fileName}`.toLowerCase().includes(needle)),
  );
  const preview = items.find((item) => item.id === previewId) ?? null;
  const isSelected = (id: string) => Boolean(selected?.has(id));

  function activate(item: MediaItem) {
    if (mode === "select") onToggle?.(item.id);
    else setPreviewId(item.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-brand-200 bg-white" role="group" aria-label="Ansicht">
          {(
            [
              { value: "grid", label: "Raster", Icon: GridIcon },
              { value: "list", label: "Liste", Icon: ListIcon },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-azure-700 ${
                view === value ? "bg-azure-800 text-white" : "text-brand-700 hover:bg-brand-50"
              }`}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>

        <select
          aria-label="Dateityp"
          value={filter}
          onChange={(event) => setFilter(event.target.value as "all" | MediaKind)}
          className="rounded-md border border-brand-200 bg-white px-3 py-2 text-sm"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <label className="relative min-w-[12rem] flex-1">
          <span className="sr-only">Dateien durchsuchen</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Dateien durchsuchen"
            className="w-full rounded-md border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </label>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-brand-600">Noch keine Dateien in der Mediathek.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-brand-600">Keine Datei passt zu Suche und Filter.</p>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((item) => {
            const on = isSelected(item.id);
            return (
              <li key={item.id}>
                <div
                  className={`relative overflow-hidden rounded-lg border bg-white transition ${
                    on ? "border-azure-700 ring-2 ring-azure-700/40" : "border-brand-200 hover:border-azure-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => activate(item)}
                    aria-pressed={mode === "select" ? on : undefined}
                    aria-label={`${item.title}, ${mode === "select" ? (on ? "ausgewählt" : "auswählen") : "Vorschau öffnen"}`}
                    className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-azure-700"
                  >
                    <div className="aspect-square w-full overflow-hidden">
                      <Thumb item={item} large />
                    </div>
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-medium text-brand-900">{item.title}</p>
                      <p className="truncate text-xs text-brand-600">
                        {formatBytes(item.sizeBytes)} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </button>
                  {mode === "select" && (
                    <>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded border-2 ${
                          on ? "border-azure-700 bg-azure-700 text-white" : "border-white bg-black/30 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewId(item.id)}
                        className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs font-medium text-azure-800 shadow hover:bg-white"
                      >
                        Vorschau
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="divide-y divide-brand-100 rounded-lg border border-brand-200 bg-white text-sm">
          {visible.map((item) => {
            const on = isSelected(item.id);
            return (
              <li key={item.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 ${on ? "bg-azure-50" : ""}`}>
                {mode === "select" && (
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle?.(item.id)}
                    aria-label={`${item.title} auswählen`}
                    className="h-4 w-4 accent-brand-600"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setPreviewId(item.id)}
                  aria-label={`Vorschau: ${item.title}`}
                  className="h-12 w-12 shrink-0 overflow-hidden rounded border border-brand-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-azure-700"
                >
                  <Thumb item={item} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-brand-900">{item.title}</p>
                  <p className="truncate text-brand-600">
                    {item.fileName}
                    {item.ownerName ? ` · von ${item.ownerName}` : ""}
                  </p>
                </div>
                <p className="w-20 text-brand-700">{MEDIA_KIND_LABELS[mediaKindOf(item.mimeType)]}</p>
                <p className="w-20 text-brand-700">{formatBytes(item.sizeBytes)}</p>
                <p className="w-24 text-brand-700">{formatDate(item.createdAt)}</p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPreviewId(item.id)}
                    className="font-medium text-azure-800 hover:text-azure-700"
                  >
                    Vorschau
                  </button>
                  {mode === "manage" && (
                    <>
                      <a
                        href={`/api/media/${item.id}`}
                        className="inline-flex items-center gap-1.5 font-medium text-azure-800 hover:text-azure-700"
                      >
                        <DownloadIcon />
                        Herunterladen
                      </a>
                      <form action={deleteMediaFile}>
                        <input type="hidden" name="fileId" value={item.id} />
                        <ConfirmButton
                          message={`„${item.title}“ wirklich aus der Mediathek entfernen?`}
                          className="inline-flex items-center gap-1.5 font-medium text-red-800 hover:text-red-700"
                        >
                          <TrashIcon />
                          Entfernen
                        </ConfirmButton>
                      </form>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {preview && (
        <PreviewDialog
          key={preview.id}
          item={preview}
          mode={mode}
          selected={isSelected(preview.id)}
          onToggle={() => onToggle?.(preview.id)}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}
