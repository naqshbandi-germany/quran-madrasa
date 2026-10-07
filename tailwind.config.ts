import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        // Ruhige Antiqua fuer Ueberschriften (siehe layout.tsx), Fliesstext bleibt serifenlos.
        display: ["var(--font-display)", "Georgia", "serif"],
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
