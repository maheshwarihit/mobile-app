import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { PersonStanding, Heart, Moon, Apple, Users, Lightbulb, Check, LogOut, RotateCcw, ArrowLeft, type LucideIcon } from "lucide-react-native";
import { formatLocalDateTime } from "@vagewell/shared";
import { Card, PrimaryButton, OutlineButton, ConfirmModal, LoadingState } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import {
  SECTIONS,
  QUESTIONS_PER_SECTION,
  MAX_ANSWER,
  sectionScore,
  overallScore,
  bandFor,
  isComplete,
  type SectionId,
  type SectionAnswers,
  type Band,
} from "@/lib/selfAssessmentScore";
import { loadSelfAssessment, saveSelfAssessment, clearSelfAssessment } from "@/lib/selfAssessmentStorage";
import { BRAND } from "@/theme";

const ICONS: Record<SectionId, LucideIcon> = {
  physical: PersonStanding,
  mental: Heart,
  lifestyle: Moon,
  nutrition: Apple,
  social: Users,
  cognitive: Lightbulb,
};

// Tile colours per score band: background / text.
const BAND_COLORS: Record<Band, { bg: string; fg: string }> = {
  thriving: { bg: "#B7E0B0", fg: "#14532D" },
  good: { bg: "#D3ECCD", fg: "#1B5E20" },
  fair: { bg: "#F8DCA6", fg: "#7A4A06" },
  attention: { bg: "#F6C4C0", fg: "#8A1F1F" },
};

const ANSWERS = Array.from({ length: MAX_ANSWER + 1 }, (_, i) => i);
const blankSection = (): SectionAnswers => Array.from({ length: QUESTIONS_PER_SECTION }, () => null);
const key = (k: string) => k as TranslationKey;

type Props = {
  /** "self" or a dependent's id — answers are kept per person. */
  personKey: string;
  onExit: () => void;
};

/** Nutrition → General Health Self-Assessment: six sections of five questions, scored 0–100 each and overall. */
export function SelfAssessment({ personKey, onExit }: Props) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const userId = profile?.id ?? null;

  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<Partial<Record<SectionId, SectionAnswers>>>({});
  const [savedAt, setSavedAt] = useState("");
  // null = the section list; otherwise that section's questions are open.
  const [openId, setOpenId] = useState<SectionId | null>(null);
  // Working copy of the open section — nothing is kept until "Save section".
  const [draft, setDraft] = useState<SectionAnswers>(blankSection());
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let active = true;
    void loadSelfAssessment(userId, personKey).then((stored) => {
      if (!active) return;
      if (stored) {
        setSaved(stored.answers);
        setSavedAt(stored.savedAt);
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [userId, personKey]);

  const open = (id: SectionId) => {
    setDraft(saved[id] ? [...saved[id]!] : blankSection());
    setOpenId(id);
  };

  const saveSection = async () => {
    if (!openId || !isComplete(draft)) return;
    setSaving(true);
    const answers = { ...saved, [openId]: draft };
    const at = new Date().toISOString();
    const ok = await saveSelfAssessment(userId, personKey, { answers, savedAt: at });
    setSaving(false);
    if (!ok) {
      toast.error(t("selfAssessment.saveFailed"));
      return;
    }
    setSaved(answers);
    setSavedAt(at);
    // No "saved" popup: the section's tile turning into its coloured score is the confirmation.
    setOpenId(null);
  };

  const reset = async () => {
    setConfirmReset(false);
    await clearSelfAssessment(userId, personKey);
    setSaved({});
    setSavedAt("");
  };

  if (!loaded) return <LoadingState message={t("common.loading")} />;

  if (openId) {
    const ready = isComplete(draft);
    return (
      <View className="gap-4">
        <Card className="gap-3 p-5">
          <View>
            <Text className="text-lg font-bold text-gray-900">{t(key(`selfAssessment.${openId}.title`))}</Text>
            <Text className="mt-0.5 text-sm text-gray-500">{t("selfAssessment.period")}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-500">{t("selfAssessment.scaleLow")}</Text>
            <Text className="text-xs text-gray-500">{t("selfAssessment.scaleHigh")}</Text>
          </View>
          {draft.map((answer, i) => (
            <View key={i} className="gap-3 rounded-xl bg-gray-50 p-3">
              <Text className="text-sm font-semibold text-gray-900">{t(key(`selfAssessment.${openId}.q${i + 1}`))}</Text>
              <View className="flex-row justify-between">
                {ANSWERS.map((value) => {
                  const selected = answer === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setDraft((d) => d.map((a, j) => (j === i ? value : a)))}
                      hitSlop={4}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t(key(`selfAssessment.scale.${value}`))}
                      className={`h-10 w-10 items-center justify-center rounded-full border active:opacity-70 ${
                        selected ? "border-purple-600 bg-purple-600" : "border-gray-300 bg-white"
                      }`}
                    >
                      {/* Shown 1–5; stored 0–4 (Never = 0 … Always = 4). */}
                      <Text className={`text-sm font-semibold ${selected ? "text-white" : "text-gray-700"}`}>{value + 1}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {answer !== null ? (
                <Text className="text-xs text-gray-500">{t(key(`selfAssessment.scale.${answer}`))}</Text>
              ) : null}
            </View>
          ))}
          {ready ? null : (
            <Text className="text-center text-xs text-gray-500">
              {t("selfAssessment.answerAll", { count: QUESTIONS_PER_SECTION })}
            </Text>
          )}
          <PrimaryButton fullWidth loading={saving} disabled={!ready} onPress={saveSection}>
            {t("selfAssessment.saveSection")}
          </PrimaryButton>
        </Card>
        <OutlineButton fullWidth icon={ArrowLeft} onPress={() => setOpenId(null)}>
          {t("common.back")}
        </OutlineButton>
      </View>
    );
  }

  const scores = SECTIONS.map((s) => ({ id: s.id, score: sectionScore(s.id, saved[s.id]) }));
  const done = scores.filter((s) => s.score !== null).length;
  const overall = overallScore(saved);

  return (
    <View className="gap-4">
      <Card className="gap-3 p-5">
        {overall !== null ? (
          <Text className="text-lg font-bold text-gray-900">
            {t("selfAssessment.overall", { score: overall, band: t(key(`selfAssessment.band.${bandFor(overall)}`)) })}
          </Text>
        ) : (
          <Text className="text-sm text-gray-500">{t("selfAssessment.intro", { done, total: SECTIONS.length })}</Text>
        )}

        <View className="flex-row flex-wrap justify-between gap-y-3">
          {scores.map(({ id, score }) => {
            const Icon = ICONS[id];
            const colors = score !== null ? BAND_COLORS[bandFor(score)] : null;
            return (
              <Pressable
                key={id}
                onPress={() => open(id)}
                accessibilityRole="button"
                style={[{ width: "48.5%" }, colors ? { backgroundColor: colors.bg, borderColor: colors.bg } : null]}
                className="gap-1 rounded-xl border border-gray-200 bg-white p-3 active:opacity-70"
              >
                <View className="flex-row items-center justify-between">
                  <Icon size={22} color={colors ? colors.fg : BRAND} />
                  {colors ? <Check size={16} color={colors.fg} /> : null}
                </View>
                {score !== null && colors ? (
                  <>
                    <Text className="text-2xl font-bold" style={{ color: colors.fg }}>
                      {score}
                    </Text>
                    <Text className="text-sm font-semibold" style={{ color: colors.fg }}>
                      {t(key(`selfAssessment.${id}.short`))}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.fg }}>
                      {t(key(`selfAssessment.band.${bandFor(score)}`))}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-base font-semibold text-gray-900">{t(key(`selfAssessment.${id}.title`))}</Text>
                    <Text className="text-xs text-gray-500">
                      {t("selfAssessment.questionCount", { count: QUESTIONS_PER_SECTION })}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        {overall === null && done > 0 ? (
          <Text className="text-xs text-gray-500">{t("selfAssessment.overallPending", { total: SECTIONS.length })}</Text>
        ) : null}
        {savedAt ? (
          <Text className="text-xs text-gray-400">{t("selfAssessment.lastSaved", { date: formatLocalDateTime(savedAt) })}</Text>
        ) : null}
        <Text className="text-xs text-gray-400">{t("selfAssessment.disclaimer")}</Text>
      </Card>

      {done > 0 ? (
        <OutlineButton fullWidth icon={RotateCcw} onPress={() => setConfirmReset(true)}>
          {t("selfAssessment.startOver")}
        </OutlineButton>
      ) : null}
      <OutlineButton fullWidth icon={LogOut} onPress={onExit}>
        {t("selfAssessment.exit")}
      </OutlineButton>

      <ConfirmModal
        open={confirmReset}
        title={t("selfAssessment.startOverTitle")}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void reset()}
        confirmLabel={t("selfAssessment.startOver")}
        cancelLabel={t("common.cancel")}
        confirmDanger
      >
        <Text className="text-sm text-gray-600">{t("selfAssessment.startOverBody")}</Text>
      </ConfirmModal>
    </View>
  );
}
