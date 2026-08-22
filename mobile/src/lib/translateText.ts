// Auto-translates free-text fields (name, address, symptom notes, …) to
// English before they're saved — the user asked for this explicitly, aware
// that machine translation of a proper name or address is sometimes wrong,
// so this is a best-effort normalization, not a guarantee of accuracy.
//
// Uses MyMemory's free, keyless translation API (https://mymemory.translated.net)
// directly from the client — this project is deliberately Supabase-native
// with no backend service (see CLAUDE.md), and a keyed service (Google
// Translate etc.) would need a server-held secret this app has nowhere to
// keep. MyMemory needs no key and is CORS-enabled, so it works from both the
// web build and native. On any failure (offline, rate limit, bad response)
// this silently returns the original text rather than blocking the save —
// a failed translation must never lose what the person actually typed.
const TAMIL_SCRIPT = /[஀-௿]/;

export function containsTamilScript(text: string): boolean {
  return TAMIL_SCRIPT.test(text);
}

export async function translateTamilToEnglish(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || !containsTamilScript(trimmed)) return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=ta|en`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = (await res.json()) as { responseData?: { translatedText?: string } };
    const translated = data.responseData?.translatedText;
    return typeof translated === "string" && translated.trim().length > 0 ? translated.trim() : text;
  } catch {
    return text;
  }
}
