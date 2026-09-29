import { BookingButton } from "@/app/booking-button";
import { prisma } from "@/lib/prisma";

export default async function TeachersPage() {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, image: true, bio: true },
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-brand-700">Unsere Lehrer</h1>
        <p className="mt-2 text-brand-600">
          Lernt die Menschen kennen, die euren Unterricht geben.
        </p>
      </section>

      {teachers.length === 0 ? (
        <p className="text-brand-600">Aktuell sind noch keine Lehrer-Profile hinterlegt.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="rounded-lg border border-brand-200 bg-white p-5">
              <div className="flex items-center gap-4">
                {teacher.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={teacher.image}
                    alt={teacher.name}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
                    {teacher.name.charAt(0)}
                  </div>
                )}
                <h2 className="text-lg font-semibold text-brand-700">{teacher.name}</h2>
              </div>
              <p className="mt-3 text-sm text-brand-600">
                {teacher.bio || "Noch keine Vita hinterlegt."}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-5 text-center">
        <p className="mb-3 text-brand-700">Fragen an einen unserer Lehrer? Lernt uns unverbindlich kennen.</p>
        <BookingButton />
      </div>
    </div>
  );
}
