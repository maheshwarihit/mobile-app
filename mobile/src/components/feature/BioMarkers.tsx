import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { Camera, ImageUp, FlaskConical, Trash2, LogOut, RotateCcw, TriangleAlert, Download, BookOpen, ArrowLeft, UserX } from "lucide-react-native";
import { formatLocalDateTime } from "@vagewell/shared";
import { Card, PrimaryButton, OutlineButton, ErrorBanner, LoadingState, Spinner } from "@/components/ui";
import { AnalysisProgress } from "@/components/feature/AnalysisProgress";
import { PhotoTray } from "@/components/feature/PhotoTray";
import { LibraryCalendar, dayKey, latestDay, dayHeading } from "@/components/feature/LibraryCalendar";
import { LibraryEntry, libraryFileName } from "@/components/feature/LibraryEntry";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { pickReport, analyzeReport, translateReport, MAX_REPORT_PAGES, PDF_THUMB_URI, type PickedReport, type ReportMediaType, type LabReport, type LabTestStatus, type LabUrgency, type ReportSource } from "@/lib/labReport";
import { loadReports, saveReport, deleteReport, addReportTranslation, type SavedReport } from "@/lib/reportLibrary";
import { syncNutrition, unsyncNutrition, syncOnce } from "@/lib/nutritionSync";
import { useTranslatedResult, detectLanguage } from "@/lib/useTranslatedResult";
import type { Language } from "@/lib/i18n";
import { saveViewImage } from "@/lib/saveViewImage";
import { toast } from "@/lib/toast";
import { BRAND } from "@/theme";

/** A report being read right now, or one whose reading failed (not stored). */
type Pending = {
  id: string;
  uri: string;
  /** Every page (photo or PDF), in order. */
  pages: { base64: string; mediaType: ReportMediaType }[];
  addedAt: string;
  phase: "analysing" | "error" | "done";
  result?: LabReport;
  error?: string;
};

/** A saved report as it is shared with the care team (a PDF has no photo of its own). */
function reportSyncItem(r: SavedReport) {
  return {
    clientId: `lab_report:${r.id}`,
    data: { result: r.result, savedAt: r.savedAt, pages: r.pages ?? 1, language: r.language },
    photoUri: r.photoUri && r.photoUri !== PDF_THUMB_URI ? r.photoUri : null,
    createdAt: r.savedAt,
  };
}

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
 * unusual values mean, suggestions and how soon to see a doctor. Each report
 * that is read is kept in this person's Report library on the device, where
 * every result can also be downloaded as a picture.
 */
export function BioMarkers({
  personKey,
  person,
  onExit,
}: {
  personKey: string;
  person: { age?: number; gender?: string };
  onExit: () => void;
}) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<ReportSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The Report library page is open.
  const [libraryOpen, setLibraryOpen] = useState(false);
  // The Report library day being shown (null: the latest day with a report).
  const [libDay, setLibDay] = useState<string | null>(null);
  // Pages of the next report gathered so far, waiting for "Read report".
  const [draft, setDraft] = useState<PickedReport[]>([]);

  useEffect(() => {
    let active = true;
    void loadReports(userId, personKey).then((list) => {
      if (!active) return;
      setSaved(list);
      setLoaded(true);
      // Shared with the care team (reports saved before syncing existed: uploaded once).
      void syncOnce(userId, personKey, "lab_report", list.map(reportSyncItem));
    });
    return () => {
      active = false;
    };
  }, [userId, personKey]);

  const update = (id: string, patch: Partial<Pending>) => setPending((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const dropPending = (id: string) => setPending((prev) => prev.filter((r) => r.id !== id));

  const read = async (item: Pending) => {
    update(item.id, { phase: "analysing", error: undefined });
    try {
      const result = await analyzeReport(item.pages, language ?? "en", person);
      // A report that could be read goes into the library; an unreadable photo
      // stays here only, with its retake tip.
      if (result.status === "ok") {
        const next = await saveReport(userId, personKey, item.uri, result, language ?? "en", item.pages.length);
        if (next) {
          setSaved(next);
          const r = reportSyncItem(next[0]);
          void syncNutrition(userId, personKey, "lab_report", r.clientId, r.data, r.photoUri, r.createdAt);
        }
      }
      update(item.id, { phase: "done", result });
    } catch (e) {
      update(item.id, { phase: "error", error: e instanceof Error ? e.message : t("bioMarkers.error.failed") });
    }
  };

  const add = async (source: ReportSource) => {
    setError(null);
    setBusy(source);
    try {
      const picked = await pickReport(source, MAX_REPORT_PAGES - draft.length);
      if (picked.length) setDraft((prev) => [...prev, ...picked].slice(0, MAX_REPORT_PAGES));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("bioMarkers.error.failed"));
    } finally {
      setBusy(null);
    }
  };

  // Send the gathered pages as one report.
  const readDraft = () => {
    if (!draft.length) return;
    const now = new Date().toISOString();
    const item: Pending = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      uri: draft[0].uri,
      pages: draft.map((p) => ({ base64: p.base64, mediaType: p.mediaType })),
      addedAt: now,
      phase: "analysing",
    };
    setDraft([]);
    setPending((prev) => [item, ...prev]);
    void read(item);
  };

  const removeSaved = async (id: string) => {
    setSaved(await deleteReport(userId, personKey, id));
    void unsyncNutrition(userId, `lab_report:${id}`);
  };

  if (!loaded) return <LoadingState message={t("common.loading")} />;

  // The chosen day while it still has reports, otherwise the latest day.
  const activeDay = libDay && saved.some((r) => dayKey(r.savedAt) === libDay) ? libDay : latestDay(saved);

  if (libraryOpen) {
    return (
      <View className="gap-4">
        <View>
          <Text className="text-base font-bold text-gray-900">{t("bioMarkers.libraryTitle")}</Text>
          <Text className="text-sm text-gray-500">{t(saved.length ? "bioMarkers.libraryHint" : "bioMarkers.empty")}</Text>
        </View>
        {/* The library as a calendar: tap a date to see that day's reports. */}
        {activeDay ? (
          <>
            <LibraryCalendar items={saved} selectedDay={activeDay} onSelectDay={setLibDay} />
            <Text className="text-sm font-bold text-gray-900">{dayHeading(activeDay, language)}</Text>
            {saved
              .filter((r) => dayKey(r.savedAt) === activeDay)
              .map((r) => (
                <LibraryReportEntry
                  key={r.id}
                  report={r}
                  onRemove={() => void removeSaved(r.id)}
                  onTranslated={(lang, translated) => void addReportTranslation(userId, personKey, r.id, lang, translated).then(setSaved)}
                />
              ))}
          </>
        ) : null}
        <OutlineButton fullWidth icon={ArrowLeft} onPress={() => setLibraryOpen(false)}>
          {t("common.back")}
        </OutlineButton>
      </View>
    );
  }

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
        {draft.length ? (
          <PhotoTray
            uris={draft.map((p) => p.uri)}
            hint={t("bioMarkers.pagesHint", { max: MAX_REPORT_PAGES })}
            onRemove={(i) => setDraft((prev) => prev.filter((_, j) => j !== i))}
          />
        ) : null}
        <View className="gap-3">
          {draft.length ? (
            <PrimaryButton fullWidth icon={FlaskConical} disabled={busy !== null} onPress={readDraft}>
              {draft.length > 1 ? t("bioMarkers.readReport", { count: draft.length }) : t("bioMarkers.readReportOne")}
            </PrimaryButton>
          ) : null}
          {draft.length < MAX_REPORT_PAGES ? (
            <>
              {draft.length ? (
                <OutlineButton fullWidth icon={Camera} loading={busy === "camera"} disabled={busy !== null} onPress={() => add("camera")}>
                  {t("bioMarkers.addPageCamera")}
                </OutlineButton>
              ) : (
                <PrimaryButton fullWidth icon={Camera} loading={busy === "camera"} disabled={busy !== null} onPress={() => add("camera")}>
                  {t("bioMarkers.takePicture")}
                </PrimaryButton>
              )}
              <OutlineButton fullWidth icon={ImageUp} disabled={busy !== null} onPress={() => add("gallery")}>
                {draft.length ? t("bioMarkers.addPageUpload") : t("bioMarkers.uploadImage")}
              </OutlineButton>
            </>
          ) : null}
        </View>
        {error ? <ErrorBanner message={error} /> : null}
      </Card>

      {pending.map((r) =>
        r.phase === "analysing" ? (
          <AnalysisProgress key={r.id} photoUri={r.uri} steps={STEPS} expectedMs={EXPECTED_MS} aspectRatio={3 / 4} fit="contain" />
        ) : r.phase === "error" ? (
          <Card key={r.id} className="gap-3 p-4">
            <ReportHeader uri={r.uri} addedAt={r.addedAt} />
            <ErrorBanner message={r.error ?? t("bioMarkers.error.failed")} />
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => void read(r)} hitSlop={8} className="flex-row items-center gap-1 active:opacity-70">
                <RotateCcw size={14} color={BRAND} />
                <Text className="text-sm font-semibold text-purple-700">{t("bioMarkers.tryAgain")}</Text>
              </Pressable>
              <RemoveLink onPress={() => dropPending(r.id)} />
            </View>
          </Card>
        ) : r.result ? (
          <View key={r.id} className="gap-2">
            <ReportResult uri={r.uri} addedAt={r.addedAt} pages={r.pages.length} result={r.result} />
            {/* Already kept in the Report library; this only clears it from here. */}
            <Pressable onPress={() => dropPending(r.id)} hitSlop={8} className="self-end active:opacity-70">
              <Text className="text-sm font-semibold text-purple-700">{t("common.done")}</Text>
            </Pressable>
          </View>
        ) : null,
      )}

      {/* Same as the Food Plate Monitor: the library behind a button, or a note while it is empty. */}
      {saved.length ? (
        <OutlineButton fullWidth icon={BookOpen} onPress={() => setLibraryOpen(true)}>
          {t("bioMarkers.libraryCount", { count: saved.length })}
        </OutlineButton>
      ) : (
        <Text className="text-center text-sm text-gray-400">{t("bioMarkers.empty")}</Text>
      )}

      <OutlineButton fullWidth icon={LogOut} onPress={onExit}>
        {t("bioMarkers.exit")}
      </OutlineButton>
    </View>
  );
}

/** A Report library entry: a compact row with View / Download / Delete, shown in the app's current language (a reading made in the other language is translated once and the translation stored). */
function LibraryReportEntry({
  report,
  onRemove,
  onTranslated,
}: {
  report: SavedReport;
  onRemove: () => void;
  onTranslated: (language: Language, translated: LabReport) => void;
}) {
  const { t, language } = useLanguage();
  const current = language ?? "en";
  const { shown, translating, failed } = useTranslatedResult({
    original: report.result,
    originalLanguage: report.language ?? detectLanguage(report.result.summary, report.result.unreadable_reason),
    stored: report.translations?.[current],
    language: current,
    translate: () => translateReport(report.result, current),
    onTranslated: (translated) => onTranslated(current, translated),
  });
  const title = [t(TYPE_KEY[shown.report_type]), ...shown.report_panels].join(" · ");
  const subtitle = [
    formatLocalDateTime(report.savedAt),
    (report.pages ?? 1) > 1 ? t("bioMarkers.pageCount", { count: report.pages ?? 1 }) : null,
    t(URGENCY_STYLE[shown.urgency].key),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <LibraryEntry
      thumbUri={report.photoUri}
      title={title}
      subtitle={subtitle}
      note={
        translating || failed ? (
          <View className="flex-row items-center gap-2">
            {translating ? <Spinner /> : null}
            <Text className="text-xs text-gray-500">{t(translating ? "common.translating" : "common.translateFailed")}</Text>
          </View>
        ) : null
      }
      fileName={libraryFileName("report", report.savedAt)}
      renderCard={() => <ReportResult uri={report.photoUri} addedAt={report.savedAt} pages={report.pages} result={shown} />}
      onDelete={onRemove}
    />
  );
}

function ReportHeader({
  uri,
  addedAt,
  pages = 1,
  title,
  badge,
}: {
  uri: string;
  addedAt: string;
  pages?: number;
  title?: string;
  badge?: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <View className="flex-row items-center gap-3">
      <View className="overflow-hidden rounded-lg bg-gray-100">
        <Image source={{ uri }} resizeMode="contain" style={{ width: 54, height: 72 }} />
      </View>
      <View className="flex-1 gap-0.5">
        {title ? <Text className="text-base font-bold text-gray-900">{title}</Text> : null}
        <Text className="text-xs text-gray-500">
          {t("bioMarkers.addedAt", { date: formatLocalDateTime(addedAt) })}
          {pages > 1 ? ` · ${t("bioMarkers.pageCount", { count: pages })}` : ""}
        </Text>
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
    // A fixed height and corner radius (not "rounded-full"): the downloaded
    // picture draws a fully-rounded label clipped at the bottom.
    <View style={{ backgroundColor: bg, height: 24, borderRadius: 12 }} className="justify-center px-2.5">
      <Text style={{ color: fg, lineHeight: 16 }} className="text-xs font-bold">
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

/** "Blood test · CBC · Lipid" — a reading's report type and panels. */
export function reportTitle(t: (k: TranslationKey) => string, result: LabReport): string {
  return [t(TYPE_KEY[result.report_type]), ...result.report_panels].join(" · ");
}

export function ReportResult({ uri, addedAt, pages, result }: { uri: string; addedAt: string; pages?: number; result: LabReport }) {
  const { t } = useLanguage();

  if (result.status === "unreadable") {
    return (
      <Card className="gap-3 p-4">
        <ReportHeader uri={uri} addedAt={addedAt} pages={pages} title={t("bioMarkers.unreadableTitle")} />
        {result.unreadable_reason ? <Text className="text-sm text-gray-700">{result.unreadable_reason}</Text> : null}
        {result.retake_tip ? (
          <View className="rounded-xl bg-amber-50 p-3">
            <Text className="text-sm text-amber-900">{result.retake_tip}</Text>
          </View>
        ) : null}
      </Card>
    );
  }

  const urgency = URGENCY_STYLE[result.urgency];
  const title = [t(TYPE_KEY[result.report_type]), ...result.report_panels].join(" · ");

  return (
    <Card className="gap-4 p-4">
      <ReportHeader uri={uri} addedAt={addedAt} pages={pages} title={title} badge={<Pill fg={urgency.fg} bg={urgency.bg} label={t(urgency.key)} />} />

      {/* Shown first and in bold: the report may belong to someone else. */}
      {result.person_mismatch ? (
        <View className="flex-row items-start gap-2 rounded-xl border p-3" style={{ backgroundColor: "#FFF4E5", borderColor: "#F5B041" }}>
          <UserX size={18} color="#9A5B00" />
          <Text className="flex-1 text-sm font-bold" style={{ color: "#7A4A06" }}>
            {result.person_mismatch}
          </Text>
        </View>
      ) : null}

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
    </Card>
  );
}
