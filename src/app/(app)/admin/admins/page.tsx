import { auth } from "@/auth";
import { InviteForm } from "@/components/invite-form";
import { inviteStaff, resendStaffInvite } from "@/lib/invite-actions";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Admins" };
export const dynamic = "force-dynamic";

export default async function AdminAdminsPage() {
  const [session, admins] = await Promise.all([
    auth(),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-azure-800">Admins</h1>

      <section aria-label="Admin-Konten" className="border border-gold-400/40 bg-white p-5">
        <ul className="space-y-2">
          {admins.map((admin) => (
            <li key={admin.id} className="border border-brand-300 px-3 py-2 text-sm">
              <details>
                <summary className="cursor-pointer text-brand-900">
                  {admin.name} ({admin.email})
                  {admin.id === session?.user.id ? " · du" : ""}
                </summary>
                {admin.id !== session?.user.id && (
                  <InviteForm
                    action={resendStaffInvite}
                    mailLabel="Einladung erneut senden"
                    linkLabel="Neuen Link erstellen"
                    className="mt-3 border-t border-brand-100 pt-3"
                  >
                    <input type="hidden" name="userId" value={admin.id} />
                  </InviteForm>
                )}
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-gold-400/40 bg-white p-5">
        <h2 className="mb-2 font-semibold text-azure-800">Admin einladen</h2>
        <p className="mb-3 text-sm text-brand-600">
          Admins haben alle Rechte. Die Person bekommt einen Link (7 Tage gültig, einmal nutzbar), über den sie ihr eigenes
          Passwort festlegt. Danach meldet sie sich mit ihrer E-Mail-Adresse an. Den Link verschickst du
          per E-Mail oder kopierst ihn, z. B. für WhatsApp.
        </p>
        <InviteForm action={inviteStaff}>
          <input type="hidden" name="role" value="ADMIN" />
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
