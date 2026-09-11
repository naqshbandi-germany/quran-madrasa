import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/prisma";

async function main() {
  const adminPasswordHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({
    where: { email: "admin@quran-madrasa.de" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@quran-madrasa.de",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const passwordHash = await bcrypt.hash("lehrer1234", 10);

  const teacher = await prisma.user.upsert({
    where: { email: "lehrer@quran-madrasa.de" },
    update: {},
    create: {
      name: "Ustadh Muhammad",
      email: "lehrer@quran-madrasa.de",
      passwordHash,
      role: Role.TEACHER,
    },
  });

  await prisma.course.upsert({
    where: { slug: "tadschwid-anfaenger" },
    update: {},
    create: {
      slug: "tadschwid-anfaenger",
      title: "Tadschwid für Anfänger",
      description:
        "Grundlagen der korrekten Koran-Rezitation: Aussprache, Buchstabenpunkte und einfache Regeln.",
      category: "Koran-Rezitation (Tadschwid)",
      priceCents: 2900,
      isPublished: true,
      teacherId: teacher.id,
      // Preis muss noch im Stripe-Dashboard angelegt und hier eingetragen werden (siehe README).
      stripePriceId: null,
    },
  });

  await prisma.course.upsert({
    where: { slug: "hifz-begleitung" },
    update: {},
    create: {
      slug: "hifz-begleitung",
      title: "Hifz-Begleitung (Koran-Memorierung)",
      description: "Wöchentliche 1:1-Begleitung beim Auswendiglernen des Korans mit Wiederholung.",
      category: "Hifz",
      priceCents: 4900,
      isPublished: true,
      teacherId: teacher.id,
      stripePriceId: null,
    },
  });

  console.log("Seed abgeschlossen. Lehrer-Login: lehrer@quran-madrasa.de / lehrer1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
