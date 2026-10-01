import type { Metadata } from "next";

import "./globals.css";
import { AuthProvider } from "./providers";

export const metadata: Metadata = {
  title: "Quran Madrasa",
  description: "Online-Unterricht für Koran-Rezitation und islamische Wissenschaften",
};

// Enthaelt nur noch das HTML-Grundgeruest. Das sichtbare Layout (Marketing-Nav
// vs. Sidebar-App-Shell) wird von den darunterliegenden Route-Groups
// (site)/layout.tsx und (app)/layout.tsx festgelegt.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
