/** @type {import('tailwindcss').Config} */
// NativeWind theme. Screens use Tailwind's `purple-*` utility classes for the brand
// accent. To re-theme the whole app in one place we REMAP the `purple` scale
// (extend.colors merges shade-by-shade) to the VAgeWell logo blue ramp — every
// existing `bg-purple-600` / `text-purple-700` etc. becomes that blue with no
// per-screen edits. The logo green is exposed separately as `accent`.
// Inline hex props (color="…") that bypass Tailwind are handled via src/theme.ts.
module.exports = {
  // `../shared/src` is included too: PAYMENT_STATUS_META/BOOKING_STATUS_META
  // (shared/src/format.ts) hold Tailwind class *strings* as plain data — e.g.
  // "bg-blue-50" — that are never independently typed as a literal className
  // anywhere in mobile/src's own JSX. Without shared in the scan glob,
  // NativeWind's JIT never sees those strings and silently never compiles the
  // corresponding CSS, so a <Pill bgClass="bg-blue-50" .../> renders with no
  // background at all — invisible, not merely uncolored. Only status values
  // that happen to reuse a color also used literally elsewhere in mobile/src
  // (gray/emerald/amber) worked by coincidence; blue/violet/indigo did not.
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}", "../shared/src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // "class" (not the Tailwind default "media") so the admin sidebar's
  // Light/Dark toggle can actually override the scheme in JS
  // (`useColorScheme().setColorScheme()`, see useThemePreference.ts) — with
  // the default "media" strategy, dark: only ever follows the OS/browser
  // preference and NativeWind *throws* if you try to override it manually.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Logo-blue brand ramp — remaps the `purple` shades the app actually uses.
        // Provide EVERY shade in use (50/100/400/500/600/700) or a stray default
        // purple would leak through.
        purple: {
          50: "#E3F1FB", // primary-light: icon chips, total banner, active cards
          100: "#C7E2F5", // light borders / avatar bg
          400: "#3E9BD6", // dashed upload active border
          500: "#1C7CBE", // input focus borders
          600: "#1C7CBE", // primary buttons, active tab
          700: "#155E92", // primary-dark: active labels, totals
        },
        // Semantic brand accent (exact-match usages).
        primary: {
          DEFAULT: "#1C7CBE",
          dark: "#155E92",
          light: "#E3F1FB",
          50: "#E3F1FB",
          100: "#C7E2F5",
          500: "#1C7CBE",
          600: "#1C7CBE",
          700: "#155E92",
        },
        // Logo green — the accent (price banner, positive highlights). Kept
        // separate from the blue `primary` ramp so the two logo colours don't
        // bleed into each other.
        accent: {
          DEFAULT: "#5FA83C",
          dark: "#4C8A2F",
          light: "#E7F4DE",
        },
        // Page background — a very light tint of the logo blue. One token
        // re-themes every screen; reads as on-brand without the muddy warmth
        // of the old cream next to the blue/green marks.
        authbg: "#EDF3F9",
        cream: "#EDF3F9",
        danger: "#A32D2D",
        warn: "#854F0B",
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
