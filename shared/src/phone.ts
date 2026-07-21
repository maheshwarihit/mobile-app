import { PHONE_COUNTRY_CODE } from "./constants";

/** Normalize a user-entered mobile number to E.164 (+91XXXXXXXXXX) or null. */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return digits.length >= 11 && digits.length <= 13 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `${PHONE_COUNTRY_CODE}${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

/** Display an E.164 number as its local part for editing. */
export function localPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const digits = e164.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
