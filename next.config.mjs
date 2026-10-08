/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Datei-Upload in die Mediathek (Server Action); Vercel-Funktionen nehmen ohnehin
    // hoechstens ca. 4,5 MB pro Anfrage an, siehe src/lib/media.ts.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
