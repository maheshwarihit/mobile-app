/** @type {import('tailwindcss').Config} */
// NativeWind theme. The web UI uses Tailwind's DEFAULT palette (bg-purple-600,
// text-gray-900, bg-emerald-50, …), which NativeWind reproduces 1:1 — so we only
// extend with the brand accent + the Nunito Sans font + the DS radius tokens.
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand (#9810FA). Components mostly use `purple-*`; `primary` is the
        // semantic brand accent where an exact brand match is wanted.
        primary: {
          DEFAULT: "#9810FA",
          50: "#faf5ff",
          100: "#f3e8ff",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7e22ce",
        },
        // Auth gradient base (design_tokens.css --color-bg-auth)
        authbg: "#f9f7ff",
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
