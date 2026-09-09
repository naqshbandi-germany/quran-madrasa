import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Zentraler Einstiegspunkt in eine Kurssitzung. Aktuell wird bei ZOOM direkt
// weitergeleitet. Sobald ein eigener Klassenraum (Video + Tafel) existiert,
// wird hier für classroomType === "IN_APP" die eigene Komponente gerendert –
// die restliche App muss dafür nicht angepasst werden.
export default async function ClassroomPage({ params }: { params: { sessionId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const classSession = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: { course: true },
  });
  if (!classSession) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: classSession.courseId } },
  });
  if (!enrollment && session.user.role === "STUDENT") {
    redirect("/dashboard");
  }

  if (classSession.classroomType === "ZOOM") {
    if (classSession.joinUrl) {
      redirect(classSession.joinUrl);
    }
    return <p className="text-brand-600">Für diese Sitzung wurde noch kein Zoom-Link hinterlegt.</p>;
  }

  // classroomType === "IN_APP" — noch nicht implementiert.
  return (
    <div className="rounded-lg border border-brand-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-brand-700">{classSession.title}</h1>
      <p className="mt-2 text-brand-600">
        Der eigene Online-Klassenraum mit Tafel ist noch nicht verfügbar. Diese Sitzung nutzt
        aktuell keine Zoom-Verbindung.
      </p>
    </div>
  );
}
