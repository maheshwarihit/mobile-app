import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { Globe, ChevronDown, Check } from "lucide-react-native";
import { useLanguage, type Language } from "@/lib/i18n";

const LABELS: Record<Language, string> = { en: "English", ta: "தமிழ்" };

/**
 * Globe-icon dropdown trigger (matches the reference design's "🌐 English ⌄"
 * pill) — the only way to change language before signing in, since the
 * one-time ChooseLanguageScreen never shows again once a language is picked
 * (see RootNavigator). ProfileScreen carries the equivalent post-auth control.
 * Tapping an option in the sheet switches immediately (setLanguage persists
 * via AsyncStorage) and closes the sheet — no separate confirm step, unlike
 * the initial picker, since this corrects an already-made choice.
 */
export function LanguageToggle({ dark = false }: { dark?: boolean }) {
  const { language, setLanguage } = useLanguage();
  const current: Language = language ?? "en";
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
          dark ? "border-white/25 bg-white/10" : "border-gray-200 bg-white"
        }`}
      >
        <Globe size={15} color={dark ? "#ffffff" : "#4b5563"} />
        <Text className={`text-sm font-medium ${dark ? "text-white" : "text-gray-700"}`}>{LABELS[current]}</Text>
        <ChevronDown size={14} color={dark ? "#ffffff" : "#9ca3af"} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-8" onPress={() => setOpen(false)}>
          <Pressable className="w-full max-w-xs overflow-hidden rounded-2xl bg-white" onPress={() => {}}>
            {(Object.keys(LABELS) as Language[]).map((lang) => {
              const active = lang === current;
              return (
                <Pressable
                  key={lang}
                  onPress={() => {
                    setLanguage(lang);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50"
                >
                  <Text className={`text-base ${active ? "font-semibold text-teal-700" : "text-gray-700"}`}>
                    {LABELS[lang]}
                  </Text>
                  {active ? <Check size={18} color="#0d9488" /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
