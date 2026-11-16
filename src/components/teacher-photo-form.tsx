"use client";

import { useActionState, useRef, useState } from "react";

import type { ActionResult } from "@/lib/account-actions";
import { TEACHER_PHOTO_MAX_BYTES } from "@/lib/teacher-photo";
import { removeTeacherPhoto, uploadTeacherPhoto } from "@/lib/teacher-photo-actions";

const INITIAL: ActionResult = { ok: false };

// Handyfotos haben oft 5 MB und mehr. Groessere Dateien verkleinert der Browser vor dem Hochladen
// (der Server schneidet danach ohnehin auf 512 x 512 Pixel zu).
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const SHRINK_TO_PX = 1600;

async function shrink(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, SHRINK_TO_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // Browser kann das Format nicht lesen: Original schicken, der Server prueft.
  }
}

// Foto im Lehrerprofil (Admin-Bereich): Vorschau, hochladen oder entfernen.
export function TeacherPhotoForm({
  teacherId,
  teacherName,
  image,
}: {
  teacherId: string;
  teacherName: string;
  image: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [state, uploadAction, uploading] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const original = formData.get("photo");
    if (original instanceof File && original.size > 0) {
      const file = await shrink(original);
      if (file.size > TEACHER_PHOTO_MAX_BYTES) {
        return { ok: false, errors: { photo: "Das Foto ist zu groß (höchstens 4 MB)." } };
      }
      formData.set("photo", file);
    }
    const result = await uploadTeacherPhoto(prev, formData);
    if (result.ok) {
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    }
    return result;
  }, INITIAL);
  const [removeState, removeAction, removing] = useActionState(removeTeacherPhoto, INITIAL);

  const shown = preview ?? image;
  const message = state.errors?.photo ?? state.message;

  return (
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt={`Foto von ${teacherName}`} className="h-20 w-20 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-700">
          {teacherName.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <form action={uploadAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="teacherId" value={teacherId} />
          <label className="text-xs text-brand-700">
            <span className="sr-only">Foto auswählen</span>
            <input
              ref={inputRef}
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="max-w-full text-sm file:mr-2 file:border file:border-brand-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
            />
          </label>
          <button disabled={uploading} className="btn-primary px-4 py-1.5 text-sm disabled:opacity-60">
            {uploading ? "Wird hochgeladen …" : "Foto hochladen"}
          </button>
        </form>
        {image && !preview && (
          <form action={removeAction}>
            <input type="hidden" name="teacherId" value={teacherId} />
            <button disabled={removing} className="text-xs text-red-800 underline disabled:opacity-60">
              Foto entfernen
            </button>
          </form>
        )}
        <p className="text-xs text-brand-600">
          JPG, PNG oder WebP. Wird quadratisch zugeschnitten und erscheint rund auf der Seite „Unsere Lehrer“.
        </p>
        {message && (
          <p role={state.ok ? "status" : "alert"} className={`text-xs ${state.ok ? "text-green-800" : "text-red-800"}`}>
            {message}
          </p>
        )}
        {removeState.message && !image && (
          <p role="status" className="text-xs text-green-800">
            {removeState.message}
          </p>
        )}
      </div>
    </div>
  );
}
