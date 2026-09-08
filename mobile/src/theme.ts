/**
 * Non-class color constants (single source of truth).
 *
 * The Tailwind `purple`→brand remap in tailwind.config.js re-themes every
 * `purple-*` utility CLASS. But some components pass colors as inline props
 * (lucide `color=`, `ActivityIndicator color=`, `tabBarActiveTintColor`) which
 * Tailwind never sees. Those import from here so there is one place to change.
 *
 * Palette is taken straight from the VAgeWell logo: the blue of the cradling
 * hands is the primary, the green of the heart/figures is the accent.
 */
export const BRAND = "#1C7CBE"; // logo blue — primary
export const BRAND_DARK = "#155E92"; // logo blue — pressed / dark
export const BRAND_LIGHT = "#E3F1FB"; // logo blue — tint (chips, active cards)

export const ACCENT_GREEN = "#5FA83C"; // logo green — accent (price banner, highlights)

export const DANGER = "#A32D2D";
export const WARN = "#854F0B";
