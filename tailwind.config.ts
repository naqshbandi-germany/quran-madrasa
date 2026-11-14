import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      keyframes: {
        // Ken-Burns-Effekt der Hero-Slides: ruhiges Heranzoomen um 8 %, ueber die gesamte Zeit,
        // die ein Slide zu sehen ist (AUTO_ADVANCE_MS in hero-carousel.tsx, gleich lang halten).
        // Schraeg liegende Buchseite (Quran-Slide): zusaetzlich richtet sie sich minimal auf.
        kenburns: {
          "0%": { transform: "rotateX(60deg) scale(1.02) translate3d(0, 0, 0)" },
          "100%": { transform: "rotateX(58.5deg) scale(1.10) translate3d(-0.8%, -1%, 0)" },
        },
        // Frontal gesehenes Foto (Beratungs-Slide)
        "kenburns-flat": {
          "0%": { transform: "scale(1) translate3d(0, 0, 0)" },
          "100%": { transform: "scale(1.08) translate3d(-1%, -0.8%, 0)" },
        },
      },
      animation: {
        kenburns: "kenburns 12s linear forwards",
        "kenburns-flat": "kenburns-flat 12s linear forwards",
      },
      fontFamily: {
        // Ruhige Antiqua fuer Ueberschriften (siehe layout.tsx), Fliesstext bleibt serifenlos.
        display: ["var(--font-display)", "Georgia", "serif"],
        quote: ["var(--font-quote)", "Georgia", "serif"],
      },
      // Farben als CSS-Variablen (Werte in globals.css): Die Website nutzt die Standardwerte,
      // der Verwaltungsbereich (Lehrer/Admin) setzt unter .app-shell eigene, sachliche Toene
      // (src/app/(app)/app-theme.css). So bleiben die Klassen gleich, nur das Theme wechselt.
      colors: {
        // Dunkelgruen als Hauptfarbe; die hellen Stufen sind warme Weiss-/Cremetoene.
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          // Rand von Eingabefeldern und Checkboxen: >= 3:1 gegen Weiss (WCAG 1.4.11)
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        // Tiefes Himmelblau (Akzente, Kopfflaechen)
        azure: {
          50: "rgb(var(--azure-50) / <alpha-value>)",
          100: "rgb(var(--azure-100) / <alpha-value>)",
          200: "rgb(var(--azure-200) / <alpha-value>)",
          600: "rgb(var(--azure-600) / <alpha-value>)",
          700: "rgb(var(--azure-700) / <alpha-value>)",
          800: "rgb(var(--azure-800) / <alpha-value>)",
          900: "rgb(var(--azure-900) / <alpha-value>)",
        },
        // Messing: Grundton der Buttons (weisse Schrift, Kontrast 4,6:1); beim Hover wechselt er zu gold-600
        brass: "rgb(var(--brass) / <alpha-value>)",
        gold: {
          200: "rgb(var(--gold-200) / <alpha-value>)",
          400: "rgb(var(--gold-400) / <alpha-value>)",
          600: "rgb(var(--gold-600) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
