import Link from "next/link";

import { auth } from "@/auth";
import { TimeZoneForm } from "@/components/time-zone-form";
import { prisma } from "@/lib/prisma";
import { teacherTimeZone } from "@/lib/time-zones";

export const metadata = { title: "Mein Profil" };
export const dynamic = "force-dynamic";

export default async function TeacherProfilePage() {
  const session = await auth();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { timeZone: true } });

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-azure-800">Mein Profil</h1>

      <section className="space-y-3 border border-gold-400/40 bg-white p-5">
        <h2 className="font-semibold text-azure-800">Zeitzone</h2>
        <p className="text-sm text-brand-600">
          Standard ist deutsche Zeit (MEZ/MESZ). Lebst du woanders, wähle deine Zeitzone: Dann zeigt der Lehrer-Bereich
          alle Zeiten in deiner Ortszeit, und du gibst Termine und Stundenplan in deiner Ortszeit ein. Über den Schalter
          oberhalb der Termine kannst du jederzeit auf MEZ wechseln. Schüler sehen immer deutsche Zeit.
        </p>
        <TimeZoneForm timeZone={teacherTimeZone(user)} />
      </section>

      <p className="text-sm text-brand-600">
        Name, muslimischen Namen und Passwort änderst du unter{" "}
        <Link href="/konto" className="font-medium underline">
          Mein Konto
        </Link>
        .
      </p>
    </div>
  );
}
