import { AgeGroup, Role, Weekday } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

import { prisma } from "../src/lib/prisma";

// Kursangebot aus dem "Naqshbandi Online Madrasah"-Flyer. Der Flyer nennt keine
// Preise und keine namentlichen Lehrer pro Kurs, daher: priceCents = 0 und
// isPublished = false (Entwurf) als Platzhalter, plus Zuordnung zum Beispiel-Lehrer.
// Vor Veröffentlichung im Lehrer-/Admin-Bereich echten Preis + Stripe-Price-ID +
// ggf. anderen Lehrer eintragen (siehe README).
const FLYER_COURSES = [
  {
    slug: "quran-level-1",
    title: "Quran Level 1 – Grundlagen",
    category: "Quran-Rezitation",
    level: "Level 1",
    ageGroups: [AgeGroup.KIDS, AgeGroup.TEENS, AgeGroup.ADULTS],
    description:
      "Einführung ins arabische Schrift­bild (Qaidah) und stufenweiser Übergang zu den " +
      "meistgelesenen Passagen und Surahs des Qurans.",
    schedule: [
      { weekday: Weekday.WEDNESDAY, startTime: "18:00", endTime: "18:40" },
      { weekday: Weekday.SATURDAY, startTime: "14:00", endTime: "14:40" },
      { weekday: Weekday.SUNDAY, startTime: "14:00", endTime: "14:40" },
    ],
  },
  {
    slug: "quran-level-2",
    title: "Quran Level 2 – Rezitation & Auswendiglernen",
    category: "Quran-Rezitation",
    level: "Level 2",
    ageGroups: [AgeGroup.KIDS, AgeGroup.TEENS, AgeGroup.ADULTS],
    description:
      "Beginn der Rezitation aus dem Heiligen Quran (Fatihah, Alif Lam Meem, Amanar Rasul, " +
      "Ayat al Kursi, Hu Allahu Lladhi, Quls), Auswendiglernen kurzer Surahs, stufenweise " +
      "Einführung der wichtigsten Tajwid-Regeln sowie die wichtigsten Duas für den Alltag.",
    schedule: [
      { weekday: Weekday.WEDNESDAY, startTime: "18:45", endTime: "19:30" },
      { weekday: Weekday.SATURDAY, startTime: "14:45", endTime: "15:30" },
      { weekday: Weekday.SUNDAY, startTime: "14:45", endTime: "15:30" },
    ],
  },
  {
    slug: "quran-level-3",
    title: "Quran Level 3 – Fortgeschrittene Rezitation",
    category: "Quran-Rezitation",
    level: "Level 3",
    ageGroups: [AgeGroup.KIDS, AgeGroup.TEENS, AgeGroup.ADULTS],
    description:
      "Fortgeschrittene Quran-Rezitation ab Fatihah mit dem Ziel, während des Kurses einen " +
      "Quran-Khatm zu vollenden. Auswendiglernen wichtiger Surahs (Juz Amma, Yasin, Waqiah, " +
      "Mulk, Sajdah, evtl. Kahf), systematische Tajwid-Regeln und vertiefte Alltags-Duas.",
    schedule: [
      { weekday: Weekday.WEDNESDAY, startTime: "19:45", endTime: "20:30" },
      { weekday: Weekday.SATURDAY, startTime: "09:00", endTime: "09:45", note: "Morgens" },
      { weekday: Weekday.SUNDAY, startTime: "09:00", endTime: "09:45", note: "Morgens" },
    ],
  },
  {
    slug: "shamail-und-seerah",
    title: "Shamail & Seerah",
    category: "Sirah & Shamail",
    level: null,
    ageGroups: [AgeGroup.KIDS, AgeGroup.TEENS],
    description:
      "Das Leben und die Eigenschaften des Propheten ﷺ anhand von Shamail Tirmidhi und " +
      "ausgewählter Sirah-Literatur – für Kinder und Jugendliche.",
    schedule: [{ weekday: Weekday.SATURDAY, startTime: "16:00", endTime: "17:00" }],
  },
  {
    slug: "imam-al-ghazali-kurs",
    title: "Imam al-Ghazali Kurs",
    category: "Islamische Charakterbildung",
    level: null,
    ageGroups: [AgeGroup.KIDS, AgeGroup.TEENS],
    description:
      "Glaube, Wissen und Charakterbildung nach Imam al-Ghazali anhand altersgerechter " +
      "Kinder- und Jugendbücher – für Kinder und Jugendliche.",
    schedule: [{ weekday: Weekday.SUNDAY, startTime: "16:00", endTime: "17:00" }],
  },
  {
    slug: "islamische-seelenlehre-charakterbildung",
    title: "Islamische Seelenlehre & Charakterbildung",
    category: "Islamische Charakterbildung",
    level: null,
    ageGroups: [AgeGroup.TEENS, AgeGroup.ADULTS],
    description:
      "Reinigung des Herzens und Charakterbildung nach klassischen Werken (u.a. Imam " +
      "al-Ghazali, Imam al-Haddad) – für Jugendliche und junge Erwachsene.",
    schedule: [{ weekday: Weekday.THURSDAY, startTime: "14:00", endTime: "15:00" }],
  },
];

// Nur fuer die lokale Entwicklung: legt Beispielkonten an und darf keine entfernte Datenbank treffen.
function assertLocalDatabase() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://unbekannt").hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    throw new Error("Der Seed ist nur für eine lokale Datenbank gedacht (DATABASE_URL zeigt nicht auf localhost).");
  }
}

// Beispielkonto anlegen, falls es fehlt. Das Passwort kommt aus der Umgebungsvariable oder wird
// zufaellig erzeugt und einmal ausgegeben; bestehende Konten bleiben unveraendert.
async function ensureAccount(email: string, name: string, role: Role, envKey: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const fromEnv = process.env[envKey];
  const password = fromEnv || randomBytes(12).toString("base64url");
  const user = await prisma.user.create({
    data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`${name}: ${email} / ${fromEnv ? `(Passwort aus ${envKey})` : password}`);
  return user;
}

async function main() {
  assertLocalDatabase();
  await ensureAccount("admin@quran-madrasa.de", "Admin", Role.ADMIN, "SEED_ADMIN_PASSWORD");
  const teacher = await ensureAccount(
    "lehrer@quran-madrasa.de",
    "Abdul Fattah",
    Role.TEACHER,
    "SEED_TEACHER_PASSWORD",
  );

  for (const { schedule, ...courseData } of FLYER_COURSES) {
    const course = await prisma.course.upsert({
      where: { slug: courseData.slug },
      update: {},
      create: {
        ...courseData,
        priceCents: 0,
        isPublished: false,
        teacherId: teacher.id,
        stripePriceId: null,
      },
    });

    // Slots sind nicht @unique, daher vor dem Neuanlegen die alten löschen (idempotenter Seed).
    await prisma.scheduleSlot.deleteMany({ where: { courseId: course.id } });
    await prisma.scheduleSlot.createMany({
      data: schedule.map((slot) => ({ ...slot, courseId: course.id })),
    });
  }

  console.log("Seed abgeschlossen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
