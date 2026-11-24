import Link from "next/link";

import { InviteForm } from "@/components/invite-form";
import { TeacherPhotoForm } from "@/components/teacher-photo-form";
import { updateTeacherProfile } from "@/lib/admin-actions";
import { inviteStaff, resendStaffInvite } from "@/lib/invite-actions";
import { prisma } from "@/lib/prisma";
import { TIME_ZONE_OPTIONS, teacherTimeZone } from "@/lib/time-zones";

export const metadata = { title: "Lehrer" };
export const dynamic = "force-dynamic";

// Lehrkraefte: Profil (Foto, Zoom-Konto, Zeitzone, Vita), Einladung und Loeschen. ?einladung=vergeben
// nach dem Speichern, wenn die E-Mail-Adresse schon zu einem anderen Konto gehoert.
export default async function AdminTeachersPage({ searchParams }: { searchParams: Promise<{ einladung?: string }> }) {
  const { einladung } = await searchParams;
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { taughtCourses: true } } },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-azure-800">Lehrer</h1>

      {einladung === "vergeben" && (
        <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Diese E-Mail-Adresse gehört schon zu einem anderen Konto.
        </p>
      )}

      <section aria-label="Lehrkräfte" className="border border-gold-400/40 bg-white p-5">
        {teachers.length === 0 ? (
          <p className="text-sm text-brand-600">Noch keine Lehrer angelegt.</p>
        ) : (
          <div className="space-y-2">
            {teachers.map((teacher) => (
              <details key={teacher.id} className="border border-brand-300 px-3 py-2">
                <summary className="cursor-pointer text-sm text-brand-900">
                  {teacher.name} ({teacher.email}) · {teacher._count.taughtCourses} Kurse
                </summary>
                <div className="mt-3 border-t border-brand-100 pt-3">
                  <TeacherPhotoForm teacherId={teacher.id} teacherName={teacher.name} image={teacher.image} />
                </div>
                <form
                  action={updateTeacherProfile}
                  className="mt-3 grid gap-2 border-t border-brand-100 pt-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="teacherId" value={teacher.id} />
                  <label className="flex flex-col text-xs text-brand-700 sm:col-span-2">
                    E-Mail-Adresse (Anmeldung)
                    <input
                      name="email"
                      type="email"
                      required
                      defaultValue={teacher.email}
                      className="mt-1 border border-brand-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col text-sm text-brand-700 sm:col-span-2">
                    Zoom-Konto: E-Mail-Adresse der Lehrkraft bei Zoom (kein Link)
                    <input
                      name="zoomEmail"
                      type="email"
                      placeholder="name@beispiel.de"
                      defaultValue={teacher.zoomEmail ?? ""}
                      className="mt-1 border border-brand-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col text-sm text-brand-700 sm:col-span-2">
                    Zeitzone (für Kurszeiten und die Anzeige im Lehrer-Bereich)
                    <select
                      name="timeZone"
                      defaultValue={teacherTimeZone(teacher)}
                      className="mt-1 border border-brand-300 bg-white px-3 py-2 text-sm"
                    >
                      {TIME_ZONE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <textarea
                    name="bio"
                    placeholder="Kurze Vita"
                    defaultValue={teacher.bio ?? ""}
                    rows={2}
                    className="border border-brand-300 px-3 py-2 text-sm sm:col-span-2"
                  />
                  <button className="btn-primary px-4 py-1.5 text-sm sm:col-span-2 sm:w-fit">
                    Profil speichern
                  </button>
                </form>
                <div className="mt-3 border-t border-brand-100 pt-3">
                  <p className="mb-2 text-xs text-brand-600">
                    Neuer Link zum Festlegen des Passworts für {teacher.email}:
                  </p>
                  <InviteForm
                    action={resendStaffInvite}
                    mailLabel="Einladung erneut senden"
                    linkLabel="Neuen Link erstellen"
                  >
                    <input type="hidden" name="userId" value={teacher.id} />
                  </InviteForm>
                </div>
                <p className="mt-3 border-t border-brand-100 pt-3 text-sm">
                  <Link href={`/admin/konten/${teacher.id}`} className="font-medium text-red-800 underline">
                    Lehrer-Konto löschen …
                  </Link>{" "}
                  <span className="text-xs text-brand-600">
                    Vorher werden die Kurse und die Mediathek einer anderen Lehrkraft zugeordnet. Hat
                    die Lehrkraft nur eine neue E-Mail-Adresse, nicht löschen: oben die Adresse ändern
                    und die Einladung erneut senden.
                  </span>
                </p>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="border border-gold-400/40 bg-white p-5">
        <h2 className="mb-2 font-semibold text-azure-800">Lehrer einladen</h2>
        <p className="mb-3 text-sm text-brand-600">
          Die Person bekommt einen Link (7 Tage gültig, einmal nutzbar), über den sie ihr eigenes
          Passwort festlegt. Danach meldet sie sich mit ihrer E-Mail-Adresse an. Den Link verschickst du
          per E-Mail oder kopierst ihn, z. B. für WhatsApp.
        </p>
        <InviteForm action={inviteStaff}>
          <input type="hidden" name="role" value="TEACHER" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="name"
              aria-label="Name"
              placeholder="Name"
              required
              minLength={2}
              className="border border-brand-300 px-3 py-2"
            />
            <input
              name="email"
              type="email"
              aria-label="E-Mail-Adresse (Anmeldung)"
              placeholder="E-Mail-Adresse (Anmeldung)"
              required
              className="border border-brand-300 px-3 py-2"
            />
          </div>
        </InviteForm>
      </section>
    </div>
  );
}
