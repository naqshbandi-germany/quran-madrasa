import { prisma } from "@/lib/prisma";
import { buildTimetable } from "@/lib/timetable";
import { renderTimetablePdf } from "@/lib/timetable-pdf";

// Immer frisch erzeugen: Inhalt und deutsche Zeiten haengen vom aktuellen Datum ab.
export const dynamic = "force-dynamic";

export async function GET() {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { title: "asc" },
    include: { scheduleSlots: true },
  });

  const pdf = await renderTimetablePdf(buildTimetable(courses));

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Stundenplan.pdf"',
    },
  });
}
