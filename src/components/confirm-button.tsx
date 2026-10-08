"use client";

import type { ButtonHTMLAttributes } from "react";

// Absende-Button, der vor dem Senden des Formulars nachfragt (z. B. beim Loeschen).
export function ConfirmButton({
  message,
  children,
  ...props
}: { message: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
