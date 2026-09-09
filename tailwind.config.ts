import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f8f3",
          100: "#e4ede1",
          200: "#c6dabf",
          400: "#7aa968",
          600: "#3f6b31",
          700: "#345826",
          900: "#1f3616",
        },
      },
    },
  },
  plugins: [],
};

export default config;
