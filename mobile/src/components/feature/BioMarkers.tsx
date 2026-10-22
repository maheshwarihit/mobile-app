import { useState } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { Camera, ImageUp, FlaskConical, Trash2, LogOut, RotateCcw, TriangleAlert } from "lucide-react-native";
import { formatLocalDateTime } from "@vagewell/shared";
import { Card, PrimaryButton, OutlineButton, ErrorBanner } from "@/components/ui";
import { AnalysisProgress } from "@/components/feature/AnalysisProgress";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { pickReport, analyzeReport, type LabReport, type LabTestStatus, type LabUrgency, type ReportSource } from "@/lib/labReport";
import { BRAND } from "@/theme";

type Report = {
  id: string;
  uri: string;
  base64: string;
  addedAt: string;
  phase: "analysing" | "done" | "error";
  result?: LabReport;
  error?: string;
};

const STEPS: TranslationKey[] = ["bioMarkers.step.read", "bioMarkers.step.find", "bioMarkers.step.compare", "bioMarkers.step.summary"];
// A full report usually takes longer to read than a plate photo.
const EXPECTED_MS = 35000;

const STATUS_STYLE: Record<LabTestStatus, { fg: string; bg: string; key: TranslationKey }> = {
  Normal: { fg: "#1E7B3A", bg: "#E6F4EA", key: "bioMarkers.status.normal" },
  High: { fg: "#9A5B00", bg: "#FDF1DC", key: "bioMarkers.status.high" },
  Low: { fg: "#9A5B00", bg: "#FDF1DC", key: "bioMarkers.status.low" },
  Critical: { fg: "#B42318", bg: "#FDE8E7", key: "bioMarkers.status.critical" },
  Unclear: { fg: "#4B5563", bg: "#F3F4F6", key: "bioMarkers.status.unclear" },
};
const URGENCY_STYLE: Record<LabUrgency, { fg: string; bg: string; key: TranslationKey }> = {
  Routine: { fg: "#1E7B3A", bg: "#E6F4EA", key: "bioMarkers.urgency.routine" },
  "Consult Soon": { fg: "#9A5B00", bg: "#FDF1DC", key: "bioMarkers.urgency.consultSoon" },
  Urgent: { fg: "#B42318", bg: "#FDE8E7", key: "bioMarkers.urgency.urgent" },
};
const TYPE_KEY: Record<LabReport["report_type"], TranslationKey> = {
  "Blood Test": "bioMarkers.type.blood",
  "Urine Routine": "bioMarkers.type.urine",
  "Stool Routine": "bioMarkers.type.stool",
  Other: "bioMarkers.type.other",
};

/**
 * Nutrition → Bio Markers: take or upload a photo of a lab report (blood test,
 * urine routine, stool routine…) and get it read in simple language: every
 * test with its range and Normal / High / Low / Critical status, what the
 * unusual values mean, suggestions, questions for the doctor and how soon to
 * see one. Reports are kept on this screen only, for the visit.
 */
export function BioMarkers({ person, onExit }: { person: { age?: number; gender?: string }; onExit: () => void }) {
  const { t, language } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState<ReportSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Report>) => setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const read = async (id: string, base64: string) => {
    update(id, { phase: "analysing", error: undefined });
    try {
      const result = await analyzeReport(base64, language ?? "en", person);
      update(id, { phase: "done", result });
    } catch (e) {
      update(id, { phase: "error", error: e instanceof Error ? e.message : t("bioMarkers.error.failed") });
    }
  };

  const add = async (source: ReportSource) => {
    setError(null);
    setBusy(source);
    try {
      const picked = await pickReport(source);
      if (!picked) return;
      const now = new Date().toISOString();
      const id = `${now}-${Math.random().toString(36).slice(2, 7)}`;
      setReports((prev) => [{ id, uri: picked.uri, base64: picked.base64, addedAt: now, phase: "analysing" }, ...prev]);
      setBusy(null);
      void read(id, picked.base64);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("bioMarkers.error.failed"));
    } finally {
      setBusy(null);
    }
  };

  const remove = (id: string) => setReports((prev) => prev.filter((r) => r.id !== id));

  return (
    <View className="gap-4">
      <Card className="gap-3 p-5">
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
            <FlaskConical size={18} color={BRAND} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900">{t("bioMarkers.addTitle")}</Text>
            <Text className="text-sm text-gray-500">{t("bioMarkers.addHint")}</Text>
          </View>
        </View>
        <View className="gap-3">
          <PrimaryButton fullWidth icon={Camera} loading={busy === "camera"} disabled={busy !== null} onPress={() => add("camera")}>
            {t("bioMarkers.takePicture")}
          </PrimaryButton>
          <OutlineButton fullWidth icon={ImageUp} disabled={busy !== null} onPress={() => add("gallery")}>
            {t("bioMarkers.uploadImage")}
          </OutlineButton>
        </View>
        {error ? <ErrorBanner message={error} /> : null}
      </Card>

      {reports.length === 0 ? <Text className="text-center text-sm text-gray-400">{t("bioMarkers.empty")}</Text> : null}

      {reports.map((r) =>
        r.phase === "analysing" ? (
          <AnalysisProgress key={r.id} photoUri={r.uri} steps={STEPS} expectedMs={EXPECTED_MS} aspectRatio={3 / 4} fit="contain" />
        ) : r.phase === "error" ? (
          <Card key={r.id} className="gap-3 p-4">
            <ReportHeader uri={r.uri} addedAt={r.addedAt} />
            <ErrorBanner message={r.error ?? t("bioMarkers.error.failed")} />
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => void read(r.id, r.base64)} hitSlop={8} className="flex-row items-center gap-1 active:opacity-70">
                <RotateCcw size={14} color={BRAND} />
                <Text className="text-sm font-semibold text-purple-700">{t("bioMarkers.tryAgain")}</Text>
              </Pressable>
              <RemoveLink onPress={() => remove(r.id)} />
            </View>
          </Card>
        ) : r.result ? (
          <ReportResult key={r.id} report={r} result={r.result} onRemove={() => remove(r.id)} />
        ) : null,
      )}

      <OutlineButton fullWidth icon={LogOut} onPress={onExit}>
        {t("bioMarkers.exit")}
      </OutlineButton>
    </View>
  );
}

function ReportHeader({ uri, addedAt, title, badge }: { uri: string; addedAt: string; title?: string; badge?: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <View className="flex-row items-center gap-3">
      <View className="overflow-hidden rounded-lg bg-gray-100">
        <Image source={{ uri }} resizeMode="contain" style={{ width: 54, height: 72 }} />
      </View>
      <View className="flex-1 gap-0.5">
        {title ? <Text className="text-base font-bold text-gray-900">{title}</Text> : null}
        <Text className="text-xs text-gray-500">{t("bioMarkers.addedAt", { date: formatLocalDateTime(addedAt) })}</Text>
      </View>
      {badge}
    </View>
  );
}

function RemoveLink({ onPress }: { onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={t("bioMarkers.remove")} className="flex-row items-center gap-1 active:opacity-70">
      <Trash2 size={14} color="#dc2626" />
      <Text className="text-sm font-semibold text-red-600">{t("bioMarkers.remove")}</Text>
    </Pressable>
  );
}

function Pill({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  return (
    <View style={{ backgroundColor: bg }} className="rounded-full px-2.5 py-1">
      <Text style={{ color: fg }} className="text-xs font-bold">
        {label}
      </Text>
    </View>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-bold text-gray-900">{title}</Text>
      {items.map((item) => (
        <View key={item} className="flex-row gap-2">
          <Text className="text-sm text-gray-700">•</Text>
          <Text className="flex-1 text-sm leading-5 text-gray-700">{item}</Text>
        </View>
      ))}
    </View>
  );
}

function ReportResult({ report, result, onRemove }: { report: Report; result: LabReport; onRemove: () => void }) {
  const { t } = useLanguage();

  if (result.status === "unreadable") {
    return (
      <Card className="gap-3 p-4">
        <ReportHeader uri={report.uri} addedAt={report.addedAt} title={t("bioMarkers.unreadableTitle")} />
        {result.unreadable_reason ? <Text className="text-sm text-gray-700">{result.unreadable_reason}</Text> : null}
        {result.retake_tip ? (
          <View className="rounded-xl bg-amber-50 p-3">
            <Text className="text-sm text-amber-900">{result.retake_tip}</Text>
          </View>
        ) : null}
        <View className="items-end">
          <RemoveLink onPress={onRemove} />
        </View>
      </Card>
    );
  }

  const urgency = URGENCY_STYLE[result.urgency];
  const title = [t(TYPE_KEY[result.report_type]), ...result.report_panels].join(" · ");

  return (
    <Card className="gap-4 p-4">
      <ReportHeader
        uri={report.uri}
        addedAt={report.addedAt}
        title={title}
        badge={<Pill fg={urgency.fg} bg={urgency.bg} label={t(urgency.key)} />}
      />

      {result.urgency === "Urgent" ? (
        <View className="flex-row items-start gap-2 rounded-xl p-3" style={{ backgroundColor: "#FDE8E7" }}>
          <TriangleAlert size={16} color="#B42318" />
          <Text className="flex-1 text-sm font-semibold" style={{ color: "#B42318" }}>
            {t("bioMarkers.urgentBanner")}
          </Text>
        </View>
      ) : null}

      {result.summary ? (
        <View className="gap-1">
          <Text className="text-sm font-bold text-gray-900">{t("bioMarkers.summaryTitle")}</Text>
          <Text className="text-sm leading-5 text-gray-700">{result.summary}</Text>
        </View>
      ) : null}

      {result.tests.length ? (
        <View className="gap-2">
          <Text className="text-sm font-bold text-gray-900">{t("bioMarkers.testsTitle")}</Text>
          {result.tests.map((test, i) => {
            const s = STATUS_STYLE[test.status];
            return (
              <View key={`${test.name}-${i}`} className="flex-row items-center gap-2 border-b border-gray-100 pb-2">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">{test.name}</Text>
                  {test.reference_range ? (
                    <Text className="text-[11px] text-gray-500">
                      {test.reference_range}
                      {test.range_source === "standard" ? ` (${t("bioMarkers.standardRange")})` : ""}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-sm font-bold text-gray-900">
                  {test.value}
                  {test.unit ? <Text className="text-[11px] font-normal text-gray-500"> {test.unit}</Text> : null}
                </Text>
                <Pill fg={s.fg} bg={s.bg} label={t(s.key)} />
              </View>
            );
          })}
        </View>
      ) : null}

      {result.abnormal_explanations.length ? (
        <View className="gap-2">
          <Text className="text-sm font-bold text-gray-900">{t("bioMarkers.explainTitle")}</Text>
          {result.abnormal_explanations.map((e) => (
            <View key={e.test} className="gap-0.5 rounded-xl bg-gray-50 p-3">
              <Text className="text-sm font-semibold text-gray-900">{e.test}</Text>
              <Text className="text-sm text-gray-700">{e.what_it_measures}</Text>
              <Text className="text-sm text-gray-700">{e.possible_causes}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Bullets title={t("bioMarkers.concernsTitle")} items={result.health_concerns} />
      <Bullets title={t("bioMarkers.dietTitle")} items={result.diet_lifestyle} />
      <Bullets title={t("bioMarkers.questionsTitle")} items={result.doctor_questions} />

      {result.disclaimer ? <Text className="text-[11px] text-gray-400">{result.disclaimer}</Text> : null}

      <View className="items-end">
        <RemoveLink onPress={onRemove} />
      </View>
    </Card>
  );
}
