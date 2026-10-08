// Fuehrt die Datenbank-Migrationen aus, aber nicht bei Vorschau-Builds von Vercel (Branches und
// offene Pull Requests): Die teilen sich sonst die echte Datenbank, und noch nicht
// freigegebene Migrationen wuerden schon vor dem Merge dort angewendet.
// Bei Production-Builds und ausserhalb von Vercel (CI, lokal) laufen sie wie gewohnt.
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
if (env && env !== "production") {
  console.log(`Vorschau-Build (VERCEL_ENV=${env}): Migrationen werden übersprungen.`);
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
