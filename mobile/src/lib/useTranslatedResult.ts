import { useEffect, useState } from "react";
import type { Language } from "@/lib/i18n";

/** Which language a stored AI result was written in, judged from its text (Tamil script or not). */
export function detectLanguage(...texts: string[]): Language {
  return texts.some((s) => /[஀-௿]/.test(s)) ? "ta" : "en";
}

/**
 * Show a stored AI result in the app's current language. When the result was
 * written in the other language and no translation is stored yet, ask for one
 * (once), hand it to `onTranslated` to be stored, and show the original
 * meanwhile — or for good, if the translation fails.
 */
export function useTranslatedResult<T>({
  original,
  originalLanguage,
  stored,
  language,
  translate,
  onTranslated,
}: {
  original: T;
  originalLanguage: Language;
  /** A translation into `language` already stored, if any. */
  stored: T | undefined;
  language: Language;
  translate: () => Promise<T>;
  onTranslated: (translated: T) => void;
}): { shown: T; translating: boolean; failed: boolean } {
  const needed = language !== originalLanguage && !stored;
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");

  useEffect(() => {
    if (!needed) return;
    let alive = true;
    setState("working");
    translate()
      .then((result) => {
        if (!alive) return;
        onTranslated(result);
        setState("idle");
      })
      .catch(() => {
        if (alive) setState("failed");
      });
    return () => {
      alive = false;
    };
    // Re-run only when the language changes or a translation becomes needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed, language]);

  return {
    shown: language === originalLanguage ? original : (stored ?? original),
    translating: needed && state === "working",
    failed: needed && state === "failed",
  };
}
