import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      keyframes: {
        // Ken-Burns-Effekt der Hero-Slides: sehr langsames, dezentes Heranzoomen. Beide
        // Varianten laufen gleich lang und mit aehnlicher Staerke (nur ca. 5 % Zoom).
        // Schraeg liegende Buchseite (Quran-Slide): zusaetzlich richtet sie sich minimal auf.
        kenburns: {
          "0%": { transform: "rotateX(60deg) scale(1.02) translate3d(0, 0, 0)" },
          "100%": { transform: "rotateX(58.5deg) scale(1.07) translate3d(-0.6%, -0.8%, 0)" },
        },
        // Frontal gesehenes Foto (Beratungs-Slide)
        "kenburns-flat": {
          "0%": { transform: "scale(1) translate3d(0, 0, 0)" },
          "100%": { transform: "scale(1.05) translate3d(-0.8%, -0.6%, 0)" },
        },
      },
      animation: {
        kenburns: "kenburns 24s linear forwards",
        "kenburns-flat": "kenburns-flat 24s linear forwards",
      },
      fontFamily: {
        // Ruhige Antiqua fuer Ueberschriften (siehe layout.tsx), Fliesstext bleibt serifenlos.
        display: ["var(--font-display)", "Georgia", "serif"],
        quote: ["var(--font-quote)", "Georgia", "serif"],
      },
      colors: {
        // Dunkelgruen als Hauptfarbe; die hellen Stufen sind warme Weiss-/Cremetoene.
        brand: {
          50: "#f8f5ef",
          100: "#f1ebdd",
          200: "#e3dac3",
          400: "#4f8a6e",
          600: "#1d6347",
          700: "#164a37",
          900: "#1d2a24",
        },
        // Tiefes Himmelblau (Akzente, Kopfflaechen)
        azure: {
          50: "#eaf2fa",
          100: "#cfe1f3",
          200: "#9fc3e6",
          600: "#2166a8",
          700: "#1b4f8a",
          800: "#14325c",
          900: "#0d2240",
        },
        gold: {
          200: "#ecdba8",
          400: "#c9a85c",
          600: "#a07f2e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
