import { createContext, useContext, useState, type ReactNode } from "react";
import { en, ta, type TranslationKey } from "./translations";

export type Language = "en" | "ta";

// Plain in-memory state, not persisted — the Choose Language screen is meant
// to show on every app open now, same as onboarding (see RootNavigator): a
// fresh mount always starts with `language` back at null, so there's nothing
// to read/write/reset. The EN/தமிழ் dropdown on Onboarding/Landing/Home still
// switches instantly mid-session; it just doesn't survive a reload, by design.
const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, ta };

type Vars = Record<string, string | number>;

type LanguageContextValue = {
  language: Language | null;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Vars) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const v = vars[name];
    return v === undefined ? match : String(v);
  });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language | null>(null);

  const t = (key: TranslationKey, vars?: Vars) => interpolate(DICTIONARIES[language ?? "en"][key], vars);

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
