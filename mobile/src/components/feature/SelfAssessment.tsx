import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { PersonStanding, Heart, Moon, Apple, Users, Lightbulb, Check, LogOut, RotateCcw, ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react-native";
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
import { syncNutrition, unsyncNutrition, syncOnce } from "@/lib/nutritionSync";
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
const BAND_COLORS: Record<Band, { bg: string; fg: string; bar: string }> = {
  thriving: { bg: "#B7E0B0", fg: "#14532D", bar: "#2E9E4F" },
  good: { bg: "#D3ECCD", fg: "#1B5E20", bar: "#8BC34A" },
  fair: { bg: "#F8DCA6", fg: "#7A4A06", bar: "#F0A93B" },
  attention: { bg: "#F6C4C0", fg: "#8A1F1F", bar: "#D9534F" },
};

// Offered from the top of the scale down: Always, Often, Sometimes, Rarely, Never.
const ANSWERS = Array.from({ length: MAX_ANSWER + 1 }, (_, i) => MAX_ANSWER - i);
// The score scale, low to high, each part as wide as its share of 0–100.
const SCALE: { band: Band; from: number; to: number }[] = [
  { band: "attention", from: 0, to: 40 },
  { band: "fair", from: 40, to: 60 },
  { band: "good", from: 60, to: 80 },
  { band: "thriving", from: 80, to: 100 },
];
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
        void syncOnce(userId, personKey, "self_assessment", [{ clientId: `self_assessment:${personKey}`, data: stored }]);
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

  // Back / Next step through the sections in order; both keep what has been
  // answered so far (a half-answered section is kept too — it just has no
  // score yet). Next needs all five answers. Back from the first section and
  // Next from the last one return to the section list.
  const step = async (direction: -1 | 1) => {
    if (!openId) return;
    if (direction === 1 && !isComplete(draft)) return;
    const index = SECTIONS.findIndex((s) => s.id === openId);
    const target = SECTIONS[index + direction]?.id ?? null;
    let answers = saved;
    if (draft.some((a) => a !== null)) {
      setSaving(true);
      answers = { ...saved, [openId]: draft };
      const at = new Date().toISOString();
      const ok = await saveSelfAssessment(userId, personKey, { answers, savedAt: at });
      setSaving(false);
      if (!ok) {
        toast.error(t("selfAssessment.saveFailed"));
        return;
      }
      setSaved(answers);
      setSavedAt(at);
      void syncNutrition(userId, personKey, "self_assessment", `self_assessment:${personKey}`, { answers, savedAt: at });
    }
    // No "saved" popup: the section's tile turning into its coloured score is the confirmation.
    if (target) setDraft(answers[target] ? [...answers[target]!] : blankSection());
    setOpenId(target);
  };

  const reset = async () => {
    setConfirmReset(false);
    await clearSelfAssessment(userId, personKey);
    void unsyncNutrition(userId, `self_assessment:${personKey}`);
    setSaved({});
    setSavedAt("");
  };

  if (!loaded) return <LoadingState message={t("common.loading")} />;

  if (openId) {
    const ready = isComplete(draft);
    const index = SECTIONS.findIndex((s) => s.id === openId);
    const isLast = index === SECTIONS.length - 1;
    return (
      <View className="gap-4">
        <Card className="gap-3 p-5">
          <View>
            <Text className="text-lg font-bold text-gray-900">{t(key(`selfAssessment.${openId}.title`))}</Text>
            <Text className="mt-0.5 text-sm text-gray-500">
              {t("selfAssessment.sectionOf", { current: index + 1, total: SECTIONS.length })} · {t("selfAssessment.period")}
            </Text>
          </View>
          {draft.map((answer, i) => (
            <View key={i} className="gap-3 rounded-xl bg-gray-50 p-3">
              <Text className="text-sm font-semibold text-gray-900">{t(key(`selfAssessment.${openId}.q${i + 1}`))}</Text>
              <View className="flex-row flex-wrap gap-2">
                {ANSWERS.map((value) => {
                  const selected = answer === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setDraft((d) => d.map((a, j) => (j === i ? value : a)))}
                      hitSlop={4}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      className={`items-center justify-center rounded-full border px-3 py-2 active:opacity-70 ${
                        selected ? "border-purple-600 bg-purple-600" : "border-gray-300 bg-white"
                      }`}
                    >
                      {/* Shown as words; stored 0–4 (Never = 0 … Always = 4). */}
                      <Text className={`text-sm font-semibold ${selected ? "text-white" : "text-gray-700"}`}>
                        {t(key(`selfAssessment.scale.${value}`))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {ready ? null : (
            <Text className="text-center text-xs text-gray-500">
              {t("selfAssessment.answerAll", { count: QUESTIONS_PER_SECTION })}
            </Text>
          )}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <OutlineButton fullWidth icon={ArrowLeft} disabled={saving} onPress={() => void step(-1)}>
                {t("common.back")}
              </OutlineButton>
            </View>
            <View className="flex-1">
              <PrimaryButton fullWidth icon={isLast ? Check : ArrowRight} loading={saving} disabled={!ready} onPress={() => void step(1)}>
                {isLast ? t("common.submit") : t("common.next")}
              </PrimaryButton>
            </View>
          </View>
        </Card>
      </View>
    );
  }

  const scores = SECTIONS.map((s) => ({ id: s.id, score: sectionScore(s.id, saved[s.id]) }));
  const done = scores.filter((s) => s.score !== null).length;
  const overall = overallScore(saved);

  return (
    <View className="gap-4">
      <Card className="gap-3 p-5">
        {overall === null ? (
          <Text className="text-sm text-gray-500">{t("selfAssessment.intro", { done, total: SECTIONS.length })}</Text>
        ) : (
          <OverallScore overall={overall} />
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

        {overall !== null ? <Results overall={overall} scores={scores} /> : null}

        {overall === null && done > 0 ? (
          <Text className="text-xs text-gray-500">{t("selfAssessment.overallPending", { total: SECTIONS.length })}</Text>
        ) : null}
        {savedAt ? (
          <Text className="text-xs text-gray-400">{t("selfAssessment.lastSaved", { date: formatLocalDateTime(savedAt) })}</Text>
        ) : null}
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

/** Top of the results: the overall wellbeing score as a big number, in its band colour. */
function OverallScore({ overall }: { overall: number }) {
  const { t } = useLanguage();
  const band = bandFor(overall);
  return (
    <View className="items-center gap-1 rounded-xl py-4" style={{ backgroundColor: BAND_COLORS[band].bg }}>
      <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: BAND_COLORS[band].fg }}>
        {t("selfAssessment.overallTitle")}
      </Text>
      <Text className="text-5xl font-bold" style={{ color: BAND_COLORS[band].fg }}>
        {overall}
        <Text className="text-lg font-semibold">/100</Text>
      </Text>
    </View>
  );
}

/** Below the six tiles once every section is done: the linear score scale, then suggestion points. */
function Results({ overall, scores }: { overall: number; scores: { id: SectionId; score: number | null }[] }) {
  const { t } = useLanguage();
  const overallBand = bandFor(overall);
  // Tips for up to three weakest sections still below "Thriving", lowest first.
  const tips = scores
    .filter((s): s is { id: SectionId; score: number } => s.score !== null && s.score < 80)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(({ id }) => t(key(`selfAssessment.tip.${id}`)));

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="mb-1 text-sm font-bold text-gray-900">{t("selfAssessment.scaleTitle")}</Text>
        {/* The bar, with a marker at the overall score. */}
        <View className="relative h-4">
          <View className="h-4 w-full flex-row overflow-hidden rounded-md">
            {SCALE.map((s, i) => (
              <View
                key={s.band}
                style={{
                  flex: s.to - s.from,
                  backgroundColor: BAND_COLORS[s.band].bar,
                  borderLeftWidth: i === 0 ? 0 : 2,
                  borderLeftColor: "#fff",
                }}
              />
            ))}
          </View>
          <View
            style={{ left: `${Math.min(100, Math.max(0, overall))}%`, marginLeft: -6 }}
            className="absolute -top-1 h-6 w-3 rounded-full border-2 border-white bg-gray-900"
          />
        </View>
        {/* Range values under the dividers: 0, 40, 60, 80, 100. */}
        <View className="flex-row">
          {SCALE.map((s, i) => (
            <View key={s.band} style={{ flex: s.to - s.from }} className="flex-row justify-between">
              <Text className="text-[11px] font-semibold text-gray-700">{i === 0 ? "0" : ""}</Text>
              <Text style={{ marginRight: i === SCALE.length - 1 ? 0 : -8 }} className="text-[11px] font-semibold text-gray-700">
                {s.to}
              </Text>
            </View>
          ))}
        </View>
        {/* Band names under each part; the person's own band in bold. */}
        <View className="flex-row">
          {SCALE.map((s) => (
            <Text
              key={s.band}
              style={{ flex: s.to - s.from }}
              className={`text-center text-[11px] ${s.band === overallBand ? "font-bold text-gray-900" : "text-gray-500"}`}
            >
              {t(key(`selfAssessment.bandShort.${s.band}`))}
            </Text>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-bold text-gray-900">{t("selfAssessment.suggestionsTitle")}</Text>
        {(tips.length ? tips : [t("selfAssessment.tip.allGood")]).map((tip) => (
          <View key={tip} className="flex-row gap-2">
            <Text className="text-sm text-gray-700">•</Text>
            <Text className="flex-1 text-sm text-gray-700">{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
