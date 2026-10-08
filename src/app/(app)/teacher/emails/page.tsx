import { auth } from "@/auth";
import { EmailComposer, type ComposerCourse } from "@/components/email-composer";
import { blobAccess, isBlobConfigured } from "@/lib/blob";
import { toMediaItem } from "@/lib/media-items";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "E-Mails – Quran Madrasa" };
export const dynamic = "force-dynamic";

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const session = await auth();
  if (!session) return null;
  const isAdmin = session.user.role === "ADMIN";
  const { course: requestedCourse } = await searchParams;

  const courses = await prisma.course.findMany({
    where: isAdmin ? {} : { teacherId: session.user.id },
    orderBy: { title: "asc" },
    include: {
      enrollments: {
        orderBy: { createdAt: "asc" },
        include: {
          participant: { select: { id: true, name: true, email: true, relation: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const files = await prisma.mediaFile.findMany({
    where: isAdmin ? {} : { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      blobPathname: true,
    },
  });
  const composerFiles = files.map((file) => toMediaItem(file));

  const composerCourses: ComposerCourse[] = courses.map((course) => ({
    id: course.id,
    title: course.title,
    participants: course.enrollments.map(({ participant, user }) => ({
      id: participant.id,
      name: participant.name,
      detail: participant.email
        ? `(${participant.email})`
        : `(Mail an ${user.name}, ${user.email})`,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">E-Mails</h1>
        <p className="mt-1 text-sm text-brand-600">
          Schreibe an alle Teilnehmer eines Kurses oder wähle einzelne Teilnehmer aus. Dateien aus
          deiner Mediathek kannst du als Anhang beifügen. Die Nachricht wird getrennt von den
          automatischen Sitzungs-Erinnerungen verschickt.
        </p>
      </div>
      <EmailComposer
        courses={composerCourses}
        files={composerFiles}
        upload={{ blobEnabled: isBlobConfigured(), blobAccess: blobAccess(), userId: session.user.id }}
        initialCourseId={composerCourses.find((c) => c.id === requestedCourse)?.id}
      />
    </div>
  );
}
