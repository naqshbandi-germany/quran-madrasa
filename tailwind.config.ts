import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Dunkelgruen als Hauptfarbe, die helleren Stufen sind warme Sand-/Cremetoene
        // (Seitenhintergrund, Rahmen), passend zur klassisch-orientalischen Anmutung.
        brand: {
          50: "#f8f3e6",
          100: "#efe6cf",
          200: "#dccfa9",
          400: "#4f8a6e",
          600: "#1d6347",
          700: "#164a37",
          900: "#10291f",
        },
        // Tiefes Himmelblau (Kopfzeile, Akzente)
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
