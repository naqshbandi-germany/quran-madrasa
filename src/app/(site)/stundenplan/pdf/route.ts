import { prisma } from "@/lib/prisma";
import { buildTimetable } from "@/lib/timetable";
import { renderTimetablePdf } from "@/lib/timetable-pdf";

// Immer frisch erzeugen: Inhalt und deutsche Zeiten haengen vom aktuellen Datum ab.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { title: "asc" },
    include: { scheduleSlots: true },
  });

  const timetable = buildTimetable(courses);

  // Die Miniaturen liegen in public/ und werden ueber die eigene Adresse geladen
  // (Dateizugriff auf public/ ist in Serverless-Funktionen nicht garantiert).
  const origin = new URL(request.url).origin;
  const sources = new Set(
    timetable.blocks.flatMap((block) => (block.miniature ? [block.miniature.src] : [])),
  );
  const images: Record<string, Uint8Array> = {};
  await Promise.all(
    [...sources].map(async (src) => {
      try {
        const response = await fetch(`${origin}${src}`);
        if (response.ok) images[src] = new Uint8Array(await response.arrayBuffer());
      } catch {
        // Ohne Bild wird der Block einfach ohne Miniatur gezeichnet.
      }
    }),
  );

  const pdf = await renderTimetablePdf(timetable, images);

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Stundenplan.pdf"',
    },
  });
}
