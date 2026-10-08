"use client";

import { useActionState, useRef } from "react";

import type { ActionResult } from "@/lib/account-actions";
import { MAX_FILE_BYTES, formatBytes } from "@/lib/media";
import { uploadMediaFile } from "@/lib/media-actions";

const INITIAL: ActionResult = { ok: false };
const INPUT = "mt-1 w-full rounded-md border border-brand-200 bg-white px-3 py-2";

export function UploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    // Zu grosse Dateien gar nicht erst senden (der Server wuerde sie ohne Meldung abweisen).
    const file = formData.get("file");
    if (file instanceof File && file.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        errors: {
          file: `Die Datei ist zu groß (${formatBytes(file.size)}). Erlaubt sind höchstens ${formatBytes(MAX_FILE_BYTES)}.`,
        },
      };
    }
    try {
      const result = await uploadMediaFile(prev, formData);
      if (result.ok) formRef.current?.reset();
      return result;
    } catch {
      return { ok: false, message: "Der Upload hat nicht geklappt. Bitte versuche es noch einmal." };
    }
  }, INITIAL);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-4 rounded-lg border border-brand-200 bg-white p-5 sm:grid-cols-2"
    >
      <label className="flex flex-col text-sm font-medium text-brand-700">
        Datei
        <input
          name="file"
          type="file"
          required
          className={`${INPUT} file:mr-3 file:rounded-md file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:font-medium file:text-brand-700`}
        />
        {state.errors?.file && <span className="mt-1 font-normal text-red-700">{state.errors.file}</span>}
      </label>
      <label className="flex flex-col text-sm font-medium text-brand-700">
        Titel (optional)
        <input name="title" maxLength={120} placeholder="z. B. Arbeitsblatt Sure Al-Fatiha" className={INPUT} />
      </label>

      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`col-span-full rounded-md px-3 py-2 text-sm ${
            state.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="col-span-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60 sm:col-span-1 sm:w-fit"
      >
        {pending ? "Wird hochgeladen …" : "Hochladen"}
      </button>
    </form>
  );
}
