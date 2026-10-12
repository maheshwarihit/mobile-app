import { useState } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { Camera, ImageUp, FlaskConical, Trash2, LogOut } from "lucide-react-native";
import { formatLocalDateTime } from "@vagewell/shared";
import { Card, PrimaryButton, OutlineButton, ErrorBanner } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";
import { pickImageAsset, takePhotoAsset, type PickedImage } from "@/lib/upload";
import { BRAND } from "@/theme";

type Report = { id: string; uri: string; addedAt: string };

/**
 * Nutrition → Bio Markers, first step: add photos of lab reports (blood
 * tests and the like), either by taking a picture or by uploading an image,
 * and see the reports added so far with the time each was added. Whole pages
 * are kept as taken — no crop step, unlike the Food Plate Monitor. The photos
 * are held on this screen only for now: nothing is uploaded, saved or read.
 */
export function BioMarkers({ onExit }: { onExit: () => void }) {
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState<"camera" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async (source: "camera" | "upload") => {
    setError(null);
    setBusy(source);
    try {
      const img: PickedImage | null = source === "camera" ? await takePhotoAsset() : await pickImageAsset();
      if (!img) return;
      if (!img.mimeType.startsWith("image/")) {
        setError(t("bioMarkers.error.notImage"));
        return;
      }
      const now = new Date().toISOString();
      setReports((prev) => [{ id: `${now}-${prev.length}`, uri: img.uri, addedAt: now }, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("bioMarkers.error.failed"));
    } finally {
      setBusy(null);
    }
  };

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
          <OutlineButton fullWidth icon={ImageUp} disabled={busy !== null} onPress={() => add("upload")}>
            {t("bioMarkers.uploadImage")}
          </OutlineButton>
        </View>
        {error ? <ErrorBanner message={error} /> : null}
      </Card>

      {reports.length === 0 ? (
        <Text className="text-center text-sm text-gray-400">{t("bioMarkers.empty")}</Text>
      ) : (
        reports.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            {/* Contained, not cropped: a report has to stay readable edge to edge. */}
            <View className="bg-gray-100">
              <Image source={{ uri: r.uri }} resizeMode="contain" style={{ width: "100%", aspectRatio: 3 / 4 }} />
            </View>
            <View className="flex-row items-center justify-between px-4 py-3">
              <Text className="text-sm text-gray-600">{t("bioMarkers.addedAt", { date: formatLocalDateTime(r.addedAt) })}</Text>
              <Pressable
                onPress={() => setReports((prev) => prev.filter((x) => x.id !== r.id))}
                hitSlop={8}
                accessibilityLabel={t("bioMarkers.remove")}
                className="flex-row items-center gap-1 active:opacity-70"
              >
                <Trash2 size={14} color="#dc2626" />
                <Text className="text-sm font-semibold text-red-600">{t("bioMarkers.remove")}</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}

      <OutlineButton fullWidth icon={LogOut} onPress={onExit}>
        {t("bioMarkers.exit")}
      </OutlineButton>
    </View>
  );
}
