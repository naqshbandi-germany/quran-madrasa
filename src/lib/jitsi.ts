import { randomBytes } from "crypto";

// Erzeugt einen Jitsi-Meeting-Link auf der oeffentlichen, kostenlosen Instanz
// meet.jit.si - kein Account, kein API-Key, keine Zeit-/Teilnehmerlimits.
// Der Raumname enthaelt einen zufaelligen Teil, damit man ihn nicht erraten
// kann (Jitsi-Raeume sind sonst allein durch den Namen "geschuetzt").
export function generateJitsiUrl(courseSlug: string) {
  const randomSuffix = randomBytes(6).toString("hex");
  const roomName = `quran-madrasa-${courseSlug}-${randomSuffix}`;
  return `https://meet.jit.si/${roomName}`;
}
