import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Check } from "lucide-react-native";
import { AppModal } from "@/components/ui";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { BRAND } from "@/theme";
import terms from "@/lib/legal/terms.json";
import privacy from "@/lib/legal/privacy.json";

/**
 * Health Disclaimer, Terms of Service and Privacy Policy. The disclaimer is
 * translated (disclaimer.ts); Terms and Privacy are English only and live in
 * lib/legal/*.json, which scripts/build-legal-pages.mjs also turns into the
 * public web pages linked from Google Play.
 */
export type LegalDoc = "disclaimer" | "terms" | "privacy";

type DocSection = { heading: string; paragraphs?: string[]; bullets?: string[]; numbered?: string[]; after?: string[] };
type JsonDoc = { title: string; updated: string; intro: string[]; sections: DocSection[] };

export const LEGAL_TITLE_KEYS: Record<LegalDoc, TranslationKey> = {
  disclaimer: "disclaimer.title",
  terms: "disclaimer.terms",
  privacy: "disclaimer.privacyPolicy",
};

const DISCLAIMER_SECTIONS: { heading: TranslationKey; body: TranslationKey; extra?: TranslationKey[] }[] = [
  { heading: "disclaimer.notAdvice.heading", body: "disclaimer.notAdvice.body" },
  { heading: "disclaimer.ai.heading", body: "disclaimer.ai.body" },
  { heading: "disclaimer.info.heading", body: "disclaimer.info.body" },
  { heading: "disclaimer.diet.heading", body: "disclaimer.diet.body" },
  {
    heading: "disclaimer.emergency.heading",
    body: "disclaimer.emergency.body",
    extra: ["disclaimer.emergency.selfHarm", "disclaimer.emergency.child"],
  },
  { heading: "disclaimer.liability.heading", body: "disclaimer.liability.body" },
  { heading: "disclaimer.privacy.heading", body: "disclaimer.privacy.body" },
];

function DisclaimerBody() {
  const { t } = useLanguage();
  return (
    <>
      <Text className="text-xs text-gray-400">{t("disclaimer.updated")}</Text>
      <Text className="text-sm text-gray-700">{t("disclaimer.intro")}</Text>
      {DISCLAIMER_SECTIONS.map((s) => (
        <View key={s.heading} className="gap-1">
          <Text className="text-sm font-bold text-gray-900">{t(s.heading)}</Text>
          <Text className="text-sm text-gray-700">{t(s.body)}</Text>
          {s.extra?.map((k) => (
            <Text key={k} className="text-sm font-semibold text-red-700">
              {t(k)}
            </Text>
          ))}
        </View>
      ))}
    </>
  );
}

function JsonDocBody({ doc }: { doc: JsonDoc }) {
  const { t, language } = useLanguage();
  const para = (p: string) => (
    <Text key={p} className="text-sm text-gray-700">
      {p}
    </Text>
  );
  return (
    <>
      {language === "ta" ?<Text className="text-xs italic text-gray-500">{t("disclaimer.englishOnly")}</Text> : null}
      <Text className="text-xs text-gray-400">{doc.updated}</Text>
      {doc.intro.map(para)}
      {doc.sections.map((s) => (
        <View key={s.heading} className="gap-1">
          <Text className="text-sm font-bold text-gray-900">{s.heading}</Text>
          {s.paragraphs?.map(para)}
          {s.bullets?.map((b) => (
            <Text key={b} className="pl-2 text-sm text-gray-700">
              • {b}
            </Text>
          ))}
          {s.numbered?.map((n, i) => (
            <Text key={n} className="pl-2 text-sm text-gray-700">
              {i + 1}. {n}
            </Text>
          ))}
          {s.after?.map(para)}
        </View>
      ))}
    </>
  );
}

/** Links to the legal documents, e.g. "Health Disclaimer · Terms of Service · Privacy Policy". */
export function LegalLinks({
  docs,
  onOpen,
  compact = false,
}: {
  docs: LegalDoc[];
  onOpen: (doc: LegalDoc) => void;
  /** Smaller text and gaps, so the footer's three links fit on one line. */
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const size = compact ? "text-xs" : "text-sm";
  const gap = compact ? "gap-1.5" : "gap-2";
  return (
    <View className={`flex-row flex-wrap items-center gap-y-1 ${compact ? "justify-center gap-x-1.5" : "gap-x-2"}`}>
      {docs.map((d, i) => (
        <View key={d} className={`flex-row items-center ${gap}`}>
          {i > 0 ? <Text className={`${size} text-gray-400`}>·</Text> : null}
          <Text className={`${size} font-semibold underline`} style={{ color: BRAND }} onPress={() => onOpen(d)} accessibilityRole="link">
            {t(LEGAL_TITLE_KEYS[d])}
          </Text>
        </View>
      ))}
    </View>
  );
}

const OTHERS: Record<LegalDoc, LegalDoc[]> = {
  disclaimer: ["terms", "privacy"],
  terms: ["disclaimer", "privacy"],
  privacy: ["disclaimer", "terms"],
};

/** One legal document, scrollable, with links to the other two at the end. */
export function LegalDocumentText({ doc, onOpen }: { doc: LegalDoc; onOpen: (doc: LegalDoc) => void }) {
  return (
    <ScrollView key={doc} style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
      {doc === "disclaimer" ? <DisclaimerBody /> : <JsonDocBody doc={(doc === "terms" ? terms : privacy) as JsonDoc} />}
      <View className="mt-1 border-t border-gray-100 pt-3">
        <LegalLinks docs={OTHERS[doc]} onOpen={onOpen} />
      </View>
    </ScrollView>
  );
}

/** Legal document popup — opened from Profile. Links inside switch to the other documents. */
export function LegalModal({ doc, onClose }: { doc: LegalDoc | null; onClose: () => void }) {
  const { t } = useLanguage();
  const [current, setCurrent] = useState<LegalDoc>(doc ?? "disclaimer");
  useEffect(() => {
    if (doc) setCurrent(doc);
  }, [doc]);
  return (
    <AppModal visible={!!doc} onClose={onClose} title={t(LEGAL_TITLE_KEYS[current])}>
      <LegalDocumentText doc={current} onOpen={setCurrent} />
    </AppModal>
  );
}

/** Footer under the Services, Appointments and Profile screens: links to all three documents. */
export function LegalFooter() {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  return (
    <View className="mt-2 items-center">
      <LegalLinks compact docs={["disclaimer", "terms", "privacy"]} onOpen={setDoc} />
      <LegalModal doc={doc} onClose={() => setDoc(null)} />
    </View>
  );
}

/** Sign-up checkbox: accept all three documents, with a link to read each one. */
export function LegalAcceptCheckbox({
  checked,
  onChange,
  onRead,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  onRead: (doc: LegalDoc) => void;
}) {
  const { t } = useLanguage();
  return (
    <View className="flex-row items-start gap-2.5">
      <Pressable
        onPress={() => onChange(!checked)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={t("disclaimer.accept")}
        className="mt-0.5 h-5 w-5 items-center justify-center rounded border"
        style={{ borderColor: checked ? BRAND : "#9ca3af", backgroundColor: checked ? BRAND : "transparent" }}
      >
        {checked ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
      </Pressable>
      <View className="flex-1 gap-1">
        <Text className="text-sm text-gray-700" onPress={() => onChange(!checked)}>
          {t("disclaimer.accept")}
        </Text>
        <LegalLinks docs={["disclaimer", "terms", "privacy"]} onOpen={onRead} />
      </View>
    </View>
  );
}
