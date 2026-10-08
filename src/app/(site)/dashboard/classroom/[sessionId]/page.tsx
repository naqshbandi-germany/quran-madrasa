import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Zentraler Einstiegspunkt in eine Kurssitzung. Bei JITSI/ZOOM wird direkt
// weitergeleitet. Sobald ein eigener Klassenraum (Video + Tafel) existiert,
// wird hier für classroomType === "IN_APP" die eigene Komponente gerendert –
// die restliche App muss dafür nicht angepasst werden.
export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { course: true },
  });
  if (!classSession) notFound();

  // Der Konto-Inhaber darf in die Sitzung, sobald mindestens ein Teilnehmer seines Kontos im
  // Kurs ist (Eltern begleiten ihre Kinder).
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: session.user.id, courseId: classSession.courseId },
  });
  if (!enrollment && session.user.role === "STUDENT") {
    redirect("/dashboard");
  }

  if (classSession.classroomType === "JITSI" || classSession.classroomType === "ZOOM") {
    if (classSession.joinUrl) {
      redirect(classSession.joinUrl);
    }
    return <p className="text-brand-600">Für diese Sitzung wurde noch kein Meeting-Link hinterlegt.</p>;
  }

  // classroomType === "IN_APP" — noch nicht implementiert.
  return (
    <div className="rounded-lg border border-brand-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-brand-700">{classSession.title}</h1>
      <p className="mt-2 text-brand-600">
        Der eigene Online-Klassenraum mit Tafel ist noch nicht verfügbar. Diese Sitzung nutzt
        aktuell keine Meeting-Verbindung.
      </p>
    </div>
  );
}
