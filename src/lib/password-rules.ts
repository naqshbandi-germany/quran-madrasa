// Passwort-Anforderungen, gemeinsam fuer die Live-Checkliste im Browser und die Pruefung auf
// dem Server (/api/register, Passwort zuruecksetzen).
//
// Bewusst nach NIST SP 800-63B: Laenge und der Ausschluss haeufiger Passwoerter statt
// Pflicht-Sonderzeichen. Erzwungene Zeichenklassen fuehren eher zu "Passwort1!" als zu
// sicheren Passwoertern.

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt verarbeitet nur die ersten 72 Bytes

// Haeufige Basiswoerter (kleingeschrieben, ohne Ziffern/Sonderzeichen am Rand).
const COMMON_BASES = [
  "passwort",
  "password",
  "passwd",
  "kennwort",
  "qwertz",
  "qwerty",
  "qwertzuiop",
  "qwertyuiop",
  "asdfgh",
  "asdfghjkl",
  "zxcvbn",
  "abcdef",
  "abcdefgh",
  "abcdefghij",
  "willkommen",
  "welcome",
  "letmein",
  "iloveyou",
  "ichliebedich",
  "sonnenschein",
  "fussball",
  "football",
  "schatz",
  "hallo",
  "hallo123",
  "master",
  "monkey",
  "dragon",
  "login",
  "admin",
  "administrator",
  "test",
  "testtest",
  "geheim",
  "internet",
  "computer",
  "bismillah",
  "muhammad",
  "mohammed",
  "allahuakbar",
  "alhamdulillah",
  "inshallah",
  "madrasa",
  "madrasah",
  "quran",
  "koran",
  "islam",
  "naqshbandi",
];

function isRepetitiveOrSequential(value: string) {
  if (/^(.)\1+$/.test(value)) return true; // aaaaaaaaaa
  const sequences = ["01234567890123456789", "98765432109876543210", "abcdefghijklmnopqrstuvwxyz", "qwertzuiopü", "asdfghjklöä"];
  return sequences.some((sequence) => sequence.includes(value));
}

export function isCommonPassword(password: string) {
  const lowered = password.toLowerCase();
  // Ziffern und Zeichen am Anfang/Ende abtrennen ("Passwort2026!" -> "passwort").
  const base = lowered.replace(/^[^a-zäöüß]+|[^a-zäöüß]+$/g, "");
  const compact = lowered.replace(/[^a-z0-9äöüß]/g, "");

  if (isRepetitiveOrSequential(compact)) return true;
  if (base && COMMON_BASES.includes(base)) return true;
  return COMMON_BASES.includes(compact);
}

export type PasswordRule = { id: string; label: string; test: (password: string) => boolean };

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "common",
    label: "Kein häufiges oder leicht erratbares Passwort",
    // Erst nach Mindestlaenge pruefen, sonst zeigt die Regel schon beim ersten Zeichen "ok".
    test: (p) => p.length >= PASSWORD_MIN_LENGTH && !isCommonPassword(p),
  },
];

export const PASSWORD_HINT =
  "Tipp: Mehrere Wörter oder ein ganzer Satz sind sicher und leicht zu merken.";

export function passwordMeetsRules(password: string) {
  return (
    password.length <= PASSWORD_MAX_LENGTH && PASSWORD_RULES.every((rule) => rule.test(password))
  );
}
