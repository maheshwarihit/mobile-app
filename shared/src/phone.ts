import { PHONE_COUNTRY_CODE } from "./constants";

/**
 * Countries the mobile-number field offers, with how many digits a mobile
 * number has there *after* the country code (no leading 0). India is first
 * and the default. Numbers are always stored in full international (E.164)
 * form, e.g. "+919876543210" or "+447700900123".
 */
export type PhoneCountry = { iso: string; name: string; dial: string; min: number; max: number };

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "IN", name: "India", dial: "+91", min: 10, max: 10 },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", min: 9, max: 9 },
  { iso: "SA", name: "Saudi Arabia", dial: "+966", min: 9, max: 9 },
  { iso: "QA", name: "Qatar", dial: "+974", min: 8, max: 8 },
  { iso: "KW", name: "Kuwait", dial: "+965", min: 8, max: 8 },
  { iso: "OM", name: "Oman", dial: "+968", min: 8, max: 8 },
  { iso: "BH", name: "Bahrain", dial: "+973", min: 8, max: 8 },
  { iso: "SG", name: "Singapore", dial: "+65", min: 8, max: 8 },
  { iso: "MY", name: "Malaysia", dial: "+60", min: 9, max: 10 },
  { iso: "LK", name: "Sri Lanka", dial: "+94", min: 9, max: 9 },
  { iso: "NP", name: "Nepal", dial: "+977", min: 10, max: 10 },
  { iso: "BD", name: "Bangladesh", dial: "+880", min: 10, max: 10 },
  { iso: "US", name: "United States", dial: "+1", min: 10, max: 10 },
  { iso: "CA", name: "Canada", dial: "+1", min: 10, max: 10 },
  { iso: "GB", name: "United Kingdom", dial: "+44", min: 10, max: 10 },
  { iso: "IE", name: "Ireland", dial: "+353", min: 9, max: 9 },
  { iso: "AU", name: "Australia", dial: "+61", min: 9, max: 9 },
  { iso: "NZ", name: "New Zealand", dial: "+64", min: 8, max: 10 },
  { iso: "DE", name: "Germany", dial: "+49", min: 10, max: 11 },
  { iso: "FR", name: "France", dial: "+33", min: 9, max: 9 },
  { iso: "NL", name: "Netherlands", dial: "+31", min: 9, max: 9 },
  { iso: "IT", name: "Italy", dial: "+39", min: 9, max: 10 },
  { iso: "CH", name: "Switzerland", dial: "+41", min: 9, max: 9 },
  { iso: "ZA", name: "South Africa", dial: "+27", min: 9, max: 9 },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

/** The country whose code an E.164 number starts with (longest code wins; +1 → United States). */
export function countryOfPhone(e164: string): PhoneCountry | null {
  const digits = e164.replace(/\D/g, "");
  let best: PhoneCountry | null = null;
  for (const c of PHONE_COUNTRIES) {
    const code = c.dial.slice(1);
    if (digits.startsWith(code) && (!best || code.length > best.dial.length - 1)) best = c;
  }
  return best;
}

/** Split a stored number into its country and the digits after the code — for the phone field. */
export function splitPhone(value: string | null | undefined): { country: PhoneCountry; national: string } {
  const v = (value ?? "").trim();
  if (!v.startsWith("+")) return { country: DEFAULT_PHONE_COUNTRY, national: v.replace(/\D/g, "") };
  const country = countryOfPhone(v);
  if (!country) return { country: DEFAULT_PHONE_COUNTRY, national: v.replace(/\D/g, "") };
  return { country, national: v.replace(/\D/g, "").slice(country.dial.length - 1) };
}

/**
 * Normalize a user-entered mobile number to E.164 or null.
 * - "+<code><number>": checked against that country's mobile-number length
 *   (any other code: 8–15 digits in total, the international maximum).
 * - No "+": an Indian number — 10 digits, or 12 starting with 91.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    const country = countryOfPhone(trimmed);
    if (!country) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
    const national = digits.slice(country.dial.length - 1).replace(/^0+/, "");
    if (national.length < country.min || national.length > country.max) return null;
    return `${country.dial}${national}`;
  }
  if (digits.length === 10) return `${PHONE_COUNTRY_CODE}${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

/**
 * Display a stored number: Indian numbers as their familiar 10 digits, any
 * other country with its code ("+44 7700900123") so it's never mistaken for
 * an Indian number.
 */
export function localPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const { country, national } = splitPhone(e164);
  if (!e164.trim().startsWith("+")) return national;
  return country.iso === "IN" ? national : `${country.dial} ${national}`;
}

/**
 * A wa.me deep link pre-filling a WhatsApp chat with `text` — opens the
 * sender's own WhatsApp (app or web) with the message ready to send, no
 * WhatsApp Business API/credentials/backend involved (that would need a paid
 * account + a pre-approved message template + a server-side secret, none of
 * which this project has). Null when there's no number to message.
 */
export function waLink(e164: string | null | undefined, text: string): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
