import type { Config } from "tailwindcss";

/**
 * Tailwind is the DS design system's styling engine. Utility classes are the
 * standard; design_tokens.css supplies CSS custom properties consumed by custom
 * CSS / dark mode. Brand primary is purple-600 (#9810FA).
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", "Nunito Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
