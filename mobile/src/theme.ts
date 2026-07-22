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

// Dark admin surface tokens (mirror the `admin` group in tailwind.config.js).
export const ADMIN_BG = "#20272A";
export const ADMIN_SURFACE = "#2A3237";
export const ADMIN_ACCENT = "#7FD8E3";
export const ADMIN_BORDER = "#3A4348";
export const ADMIN_TEXT = "#E6EDEF";
export const ADMIN_MUTED = "#9BAAB0";
