// Anzeige von Namen mit optionalem muslimischem Namen (z. B. bei Konvertiten zusaetzlich zum
// Namen im Ausweis). Darf auch im Browser verwendet werden.

type Named = { name: string; muslimName?: string | null };

// Anrede, z. B. in E-Mails ("Salam alaykum Abdullah"): der muslimische Name, falls angegeben.
export function callName(person: Named) {
  return person.muslimName?.trim() || person.name;
}

// Vollstaendige Anzeige fuer Lehrkraefte und Admins: "Abdullah (Thomas Müller)".
export function fullName(person: Named) {
  const muslim = person.muslimName?.trim();
  return muslim && muslim !== person.name ? `${muslim} (${person.name})` : person.name;
}
