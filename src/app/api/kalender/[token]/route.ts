import { getAppUrl } from "@/lib/app-url";
import { buildCalendar } from "@/lib/ics";
import { prisma } from "@/lib/prisma";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

// Kalender-Abo eines Kontos: alle Sitzungen der eingeschriebenen Kurse ab 30 Tagen zurueck. Der
// Link enthaelt einen geheimen Schluessel (User.calendarToken), da Kalender-Apps sich nicht
// anmelden koennen. Verschobene oder abgesagte Stunden aktualisieren sich beim naechsten Abruf.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cleanToken = token.replace(/\.ics$/, "");
  const user = cleanToken
    ? await prisma.user.findUnique({ where: { calendarToken: cleanToken }, select: { id: true } })
    : null;
  if (!user) return new Response("Nicht gefunden.", { status: 404 });

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    select: { courseId: true },
  });
  const courseIds = [...new Set(enrollments.map((e) => e.courseId))];
  const sessions = await prisma.classSession.findMany({
    where: {
      courseId: { in: courseIds },
      startsAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: { course: { select: { title: true } } },
    orderBy: { startsAt: "asc" },
  });

  const appUrl = getAppUrl();
  const body = buildCalendar(
    SITE_NAME,
    new URL(appUrl).host,
    sessions.map((s) => ({
      id: s.id,
      title: s.title,
      courseTitle: s.course.title,
      startsAt: s.startsAt,
      durationMin: s.durationMin,
      url: `${appUrl}/dashboard/classroom/${s.id}`,
    })),
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="islam-unter-freunden.ics"',
      "Cache-Control": "no-store",
    },
  });
}
