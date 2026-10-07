import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";

import "./globals.css";
import { AuthProvider } from "./providers";

const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Quran Madrasa",
  description: "Online-Unterricht für Koran-Rezitation und islamische Wissenschaften",
};

// Enthaelt nur noch das HTML-Grundgeruest. Das sichtbare Layout (Marketing-Nav
// vs. Sidebar-App-Shell) wird von den darunterliegenden Route-Groups
// (site)/layout.tsx und (app)/layout.tsx festgelegt.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={display.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
