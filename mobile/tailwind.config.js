/** @type {import('tailwindcss').Config} */
// NativeWind theme. Screens use Tailwind's `purple-*` utility classes for the brand
// accent. To re-theme the whole app to teal in one place we REMAP the `purple` scale
// (extend.colors merges shade-by-shade) to the teal ramp — every existing
// `bg-purple-600` / `text-purple-700` etc. becomes teal with no per-screen edits.
// Inline hex props (color="…") that bypass Tailwind are handled via src/theme.ts.
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Teal brand ramp — remaps the `purple` shades the app actually uses.
        // Provide EVERY shade in use (50/100/400/500/600/700) or a stray default
        // purple would leak through.
        purple: {
          50: "#E1F3F6", // primary-light: icon chips, total banner, active cards
          100: "#C3E7EC", // light borders / avatar bg
          400: "#35A0BE", // dashed upload active border
          500: "#12809E", // input focus borders
          600: "#12809E", // primary buttons, active tab
          700: "#0C5F74", // primary-dark: active labels, totals
        },
        // Semantic brand accent (exact-match usages).
        primary: {
          DEFAULT: "#12809E",
          dark: "#0C5F74",
          light: "#E1F3F6",
          50: "#E1F3F6",
          100: "#C3E7EC",
          500: "#12809E",
          600: "#12809E",
          700: "#0C5F74",
        },
        // Page background — cream (was pale lavender). One token re-themes all screens.
        authbg: "#F1EFE8",
        cream: "#F1EFE8",
        danger: "#A32D2D",
        warn: "#854F0B",
        // Dark admin surface (the "🔒 Admin Portal" chrome).
        admin: {
          DEFAULT: "#20272A",
          bg: "#20272A",
          surface: "#2A3237",
          accent: "#7FD8E3",
          border: "#3A4348",
          text: "#E6EDEF",
          muted: "#9BAAB0",
        },
      },
      fontFamily: {
        sans: ["NunitoSans_400Regular"],
        medium: ["NunitoSans_600SemiBold"],
        semibold: ["NunitoSans_600SemiBold"],
        bold: ["NunitoSans_700Bold"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
    },
  },
  plugins: [],
};
