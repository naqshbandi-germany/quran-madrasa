"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
  id: string;
  error?: string | null;
  children: ReactNode;
};

// Checkbox mit grosser Klickflaeche; der ganze Text ist das Label. Fehler sind per
// aria-describedby verknuepft.
export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  { id, error, children, className = "", ...input },
  ref,
) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-brand-300 accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700"
          {...input}
        />
        <label htmlFor={id} className="text-sm leading-snug text-brand-900">
          {children}
        </label>
      </div>
      {error && (
        <p id={errorId} className="mt-1 pl-8 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
});
