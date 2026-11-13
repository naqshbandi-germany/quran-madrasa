import { getAppUrl } from "@/lib/app-url";
import { groupRecipients } from "@/lib/enrollment-recipients";
import { buildEmail, emailRenderer } from "@/lib/email-templates";
import { escapeHtml } from "@/lib/html";
import { prisma } from "@/lib/prisma";
import { deliverEmail, EMAIL_FROM } from "@/lib/resend";
import { formatGermanDateTime } from "@/lib/schedule-time";

// Benachrichtigungen ausserhalb der Erinnerungen: Bestaetigung der Anmeldung, verschobene oder
// abgesagte Stunden und fehlgeschlagene Zahlungen. Ein Fehler beim Versand wird protokolliert,
// bricht aber die eigentliche Aktion (Webhook, Aenderung durch die Lehrkraft) nicht ab.

function when(date: Date) {
  return `${formatGermanDateTime(date, "full")} Uhr (deutsche Zeit)`;
}

async function sendSafely(to: string, { subject, html }: { subject: string; html: string }) {
  try {
    await deliverEmail({ from: EMAIL_FROM, to, subject, html });
  } catch (err) {
    console.error(`E-Mail "${subject}" an ${to} fehlgeschlagen:`, err);
  }
}

const enrollmentInclude = {
  user: { select: { name: true, email: true } },
  participant: { select: { name: true, email: true } },
} as const;

// Nach erfolgreicher Zahlung: Bestaetigung an die neu eingeschriebenen Teilnehmer (bzw. den
// Konto-Inhaber) mit den naechsten Terminen.
export async function sendEnrollmentConfirmation(courseId: string, enrollmentIds: string[]) {
  if (enrollmentIds.length === 0) return;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      teacher: { select: { name: true } },
      sessions: { where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 3 },
    },
  });
  if (!course) return;
  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: enrollmentIds } },
    include: enrollmentInclude,
  });

  const appUrl = getAppUrl();
  const sessionsHtml =
    course.sessions.length > 0
      ? `<p><strong>Die nächsten Termine:</strong></p><ul>${course.sessions
          .map((s) => `<li>${escapeHtml(s.title)}: ${when(s.startsAt)}</li>`)
          .join("")}</ul>`
      : "<p>Die Termine werden noch bekannt gegeben. Du bekommst vor jeder Stunde eine Erinnerung.</p>";

  const render = await emailRenderer("enrollment_confirmed");
  for (const recipient of groupRecipients(enrollments)) {
    await sendSafely(
      recipient.email,
      render({
        name: recipient.greetingName,
        kurs: course.title,
        lehrer: course.teacher.name,
        teilnehmer: recipient.participantNames.join(", "),
        termine: sessionsHtml,
        link: `${appUrl}/dashboard`,
      }),
    );
  }
}

type ChangedSession = { courseId: string; title: string; startsAt: Date };

// Lehrkraft hat eine kommende Stunde verschoben oder abgesagt: alle Teilnehmer informieren.
export async function sendSessionChangeNotice(
  kind: "moved" | "cancelled",
  before: ChangedSession,
  after?: { startsAt: Date; durationMin: number },
) {
  if (before.startsAt.getTime() < Date.now() && kind === "cancelled") return;
  const course = await prisma.course.findUnique({
    where: { id: before.courseId },
    include: { enrollments: { include: enrollmentInclude } },
  });
  if (!course || course.enrollments.length === 0) return;

  const appUrl = getAppUrl();
  const renderMoved = await emailRenderer("session_moved");
  const renderCancelled = await emailRenderer("session_cancelled");

  for (const recipient of groupRecipients(course.enrollments)) {
    const values = {
      name: recipient.greetingName,
      kurs: course.title,
      stunde: before.title,
      link: `${appUrl}/dashboard`,
    };
    await sendSafely(
      recipient.email,
      kind === "moved" && after
        ? renderMoved({
            ...values,
            datum_alt: when(before.startsAt),
            datum: when(after.startsAt),
            dauer: String(after.durationMin),
          })
        : renderCancelled({ ...values, datum: when(before.startsAt) }),
    );
  }
}

// Stripe konnte eine Abo-Zahlung nicht einziehen: Konto-Inhaber bitten, die Zahlungsdaten zu
// pruefen. Stripe versucht es selbst noch einige Male (Einstellung im Stripe-Dashboard).
export async function sendPaymentFailedNotice(stripeCustomerId: string, courseId: string | null) {
  const user = await prisma.user.findUnique({ where: { stripeCustomerId } });
  if (!user) return;
  const course = courseId ? await prisma.course.findUnique({ where: { id: courseId } }) : null;
  await sendSafely(
    user.email,
    await buildEmail("payment_failed", {
      name: user.name,
      kurs: course?.title ?? "deine Teilnahme",
      link: `${getAppUrl()}/dashboard/billing`,
    }),
  );
}
