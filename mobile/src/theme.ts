/**
 * Non-class color constants (single source of truth).
 *
 * The Tailwind `purple`→teal remap in tailwind.config.js re-themes every
 * `purple-*` utility CLASS. But some components pass colors as inline props
 * (lucide `color=`, `ActivityIndicator color=`, `tabBarActiveTintColor`) which
 * Tailwind never sees. Those import from here so there is one place to change.
 */
export const BRAND = "#12809E"; // teal primary
export const BRAND_DARK = "#0C5F74"; // teal primary-dark
export const BRAND_LIGHT = "#E1F3F6"; // teal primary-light

export const DANGER = "#A32D2D";
export const WARN = "#854F0B";
