import { startViewAs } from "@/lib/view-as-actions";

type Person = { id: string; name: string; email: string };

const SELECT = "min-w-0 flex-1 border border-brand-300 bg-white px-3 py-2 text-sm";
const BUTTON = "shrink-0 border border-brand-300 px-4 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50";

// Entwicklermodus im Admin-Bereich: per Knopfdruck die Website als ein bestimmter Lehrer oder
// Schueler ansehen. Zurueck geht es ueber die gelbe Leiste oben auf jeder Seite.
export function ViewAsPicker({ teachers, students }: { teachers: Person[]; students: Person[] }) {
  return (
    <section className="border border-gold-400/40 bg-white p-5">
      <h2 className="font-semibold text-azure-800">Entwicklermodus: Ansicht wechseln</h2>
      <p className="mb-4 mt-1 text-sm text-brand-600">
        Zeigt die Website genau so, wie die gewählte Person sie sieht. Solange die Ansicht läuft,
        sind Änderungen gesperrt; über die gelbe Leiste oben geht es zurück zur Admin-Ansicht.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: "Lehrer-Ansicht", people: teachers, empty: "Noch keine Lehrer." },
          { label: "Schüler-Ansicht", people: students, empty: "Noch keine Schüler." },
        ].map((group) => (
          <form key={group.label} action={startViewAs} className="text-sm">
            <label className="block font-medium text-brand-900" htmlFor={`view-as-${group.label}`}>
              {group.label}
            </label>
            {group.people.length === 0 ? (
              <p className="mt-1 text-brand-600">{group.empty}</p>
            ) : (
              <div className="mt-1 flex gap-2">
                <select id={`view-as-${group.label}`} name="userId" className={SELECT}>
                  {group.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </option>
                  ))}
                </select>
                <button className={BUTTON}>Ansehen</button>
              </div>
            )}
          </form>
        ))}
      </div>
    </section>
  );
}
