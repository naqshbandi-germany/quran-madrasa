import Link from "next/link";

import { EmailComposer } from "@/components/email-composer";
import { WhatsappGroupList, type WhatsappMember } from "@/components/whatsapp-group-list";
import { blobAccess, isBlobConfigured } from "@/lib/blob";
import { nameWithMuslimName, requireManagedCourse } from "@/lib/course-manage";
import { toMediaItem } from "@/lib/media-items";
import { prisma } from "@/lib/prisma";

// Reiter "Nachrichten": E-Mail an Teilnehmer (oder Hoerprobe anfordern) und WhatsApp-Gruppe.
export default async function CourseMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ an?: string }>;
}) {
  const { id } = await params;
  const { an } = await searchParams;
  const { session, course, isAdmin } = await requireManagedCourse(id);

  const [enrollments, mediaFiles] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: id },
      include: { participant: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mediaFile.findMany({
      where: isAdmin ? {} : { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true, blobPathname: true },
    }),
  ]);

  // WhatsApp-Nummern nur mit Einwilligung, je Nummer eine Zeile (Geschwister teilen oft die Nummer).
  // Als aufgenommen gilt eine Nummer, wenn alle Teilnehmer mit dieser Nummer markiert sind.
  const whatsappMembers: WhatsappMember[] = [];
  for (const { participant, whatsappAddedAt } of enrollments) {
    if (!participant.whatsapp || !participant.whatsappConsentAt) continue;
    const name = nameWithMuslimName(participant);
    const existing = whatsappMembers.find((m) => m.whatsapp === participant.whatsapp);
    if (existing) {
      existing.names += `, ${name}`;
      existing.added = existing.added && whatsappAddedAt !== null;
    } else {
      whatsappMembers.push({ whatsapp: participant.whatsapp, names: name, added: whatsappAddedAt !== null });
    }
  }
  const preselected = enrollments.some((e) => e.participantId === an) ? [an!] : undefined;

  return (
    <div className="space-y-8">
      <section aria-labelledby="mail" className="space-y-4">
        <h2 id="mail" className="font-semibold text-azure-800">
          E-Mail an Teilnehmer
        </h2>
        <p className="text-sm text-brand-600">
          Schreibe an alle Teilnehmer dieses Kurses oder an einzelne, hänge Dateien aus deiner{" "}
          <Link href="/teacher/mediathek" className="font-medium text-azure-800 underline">
            Mediathek
          </Link>{" "}
          an oder fordere eine Hörprobe an. Die Nachricht wird getrennt von den automatischen
          Sitzungs-Erinnerungen verschickt.
        </p>
        <EmailComposer
          // Neue Vorauswahl ueber "Nachricht schreiben" baut das Formular neu auf.
          key={an ?? "alle"}
          courses={[
            {
              id: course.id,
              title: course.title,
              participants: enrollments.map(({ participant, user }) => ({
                id: participant.id,
                name: nameWithMuslimName(participant),
                detail: participant.email ? `(${participant.email})` : `(Mail an ${user.name}, ${user.email})`,
              })),
            },
          ]}
          initialSelectedIds={preselected}
          allowSampleRequest
          files={mediaFiles.map((file) => toMediaItem(file))}
          upload={{ blobEnabled: isBlobConfigured(), blobAccess: blobAccess(), userId: session.user.id }}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-azure-800">WhatsApp-Gruppe des Kurses</h2>
        {whatsappMembers.length === 0 ? (
          <p className="text-sm text-brand-600">Noch niemand hat eine WhatsApp-Nummer für die Kurs-Gruppe angegeben.</p>
        ) : (
          <WhatsappGroupList courseId={course.id} members={whatsappMembers} />
        )}
      </section>
    </div>
  );
}
