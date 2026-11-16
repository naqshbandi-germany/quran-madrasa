import { prisma } from "@/lib/prisma";

// Oeffentliches Foto einer Lehrkraft (Seite "Unsere Lehrer"). Die Adresse traegt ?v=<Zeitpunkt>,
// ein neues Foto bekommt also eine neue Adresse; deshalb darf lange zwischengespeichert werden.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await prisma.teacherPhoto.findUnique({
    where: { userId: id },
    select: { mimeType: true, data: true },
  });
  if (!photo) return new Response("Nicht gefunden.", { status: 404 });

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
