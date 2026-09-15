import { AgeGroup, Role, Weekday } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/prisma";

// Kursangebot aus dem "Naqshbandi Online Madrasah"-Flyer. Der Flyer nennt keine
// Preise und keine namentlichen Lehrer pro Kurs, daher: priceCents = 0 und
// isPublished = false (Entwurf) als Platzhalter, plus Zuordnung zum Beispiel-Lehrer.
// Vor Veröffentlichung im Lehrer-/Admin-Bereich echten Preis + Stripe-Price-ID +
// ggf. anderen Lehrer eintragen (siehe README).
const FLYER_COURSES = [
  {
    slug: "quran-level-1",
    title: "Qur'an Level 1 – Grundlagen",
    category: "Qur'an-Rezitation",
    level: "Level 1",
    ageGroups: [AgeGroup.KIDS, AgeGroup.TEENS, AgeGroup.ADULTS],
    description:
      "Einführung ins arabische Schrift­bild (Qaidah) und stufenweiser Übergang zu den " +
      "meistgelesenen Passagen und Surahs des Korans.",
    schedule: [
      { weekday: Weekday.WEDNESDAY, startTime: "18:00", endTime: "18:40" },
      { weekday: Weekday.SATURDAY, startTime: "14:00", endTime: "14:40" },
      { weekday: Weekday.SUNDAY, startTime: "14:00", endTime: "14:40" },
    ],
  },
  {
    slug: "quran-level-2",
    title: "Qur'an Level 2 – Rezitation & Auswendiglernen",
    category: "Qur'an-Rezitation",
    level: "Level 2",
    ageGroups: [AgeGroup.KIDS, AgeGroup.TEENS, AgeGroup.ADULTS],
    description:
      "Beginn der Rezitation aus dem Heiligen Koran (Fatihah, Alif Lam Meem, Amanar Rasul, " +
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
    title: "Qur'an Level 3 – Fortgeschrittene Rezitation",
    category: "Qur'an-Rezitation",
    level: "Level 3",
    ageGroups: [AgeGroup.KIDS, AgeGroup.TEENS, AgeGroup.ADULTS],
    description:
      "Fortgeschrittene Koranrezitation ab Fatihah mit dem Ziel, während des Kurses einen " +
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
