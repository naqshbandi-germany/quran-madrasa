"use client";

import { SessionProvider } from "next-auth/react";

import { ViewAsBanner } from "@/components/view-as-banner";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ViewAsBanner />
      {children}
    </SessionProvider>
  );
}
