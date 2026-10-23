import { useRef, useState, type ReactNode } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { Eye, EyeOff, Download, Trash2 } from "lucide-react-native";
import { Card, Spinner } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";
import { saveViewImage } from "@/lib/saveViewImage";
import { toast } from "@/lib/toast";
import { BRAND, DANGER } from "@/theme";

/**
 * One saved item in the Meal or Report library, as a compact row — photo,
 * title, when — with View (opens the full result below it), Download (saves
 * the full result as a picture) and Delete.
 */
export function LibraryEntry({
  thumbUri,
  title,
  subtitle,
  note,
  fileName,
  renderCard,
  onDelete,
}: {
  thumbUri: string;
  title: string;
  subtitle: string;
  /** A small line above the row, e.g. "Translating…". */
  note?: ReactNode;
  /** Download file name, e.g. vagewell-meal-2026-10-22-1430.png */
  fileName: string;
  /** The full result card shown by View and captured by Download. */
  renderCard: () => ReactNode;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<View>(null);

  const download = async () => {
    setSaving(true);
    // The picture is taken of the full card, so show it first if it is closed.
    if (!open) {
      setOpen(true);
      await new Promise((r) => setTimeout(r, 400));
    }
    const ok = await saveViewImage(cardRef, fileName);
    setSaving(false);
    if (!ok) toast.error(t("common.downloadFailed"));
  };

  return (
    <View className="gap-2">
      {note}
      <Card className="gap-3 p-3">
        <View className="flex-row items-center gap-3">
          <Image source={{ uri: thumbUri }} resizeMode="cover" style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: "#e5e7eb" }} />
          <View className="flex-1 gap-0.5">
            <Text numberOfLines={2} className="text-sm font-semibold text-gray-900">
              {title}
            </Text>
            <Text className="text-xs text-gray-500">{subtitle}</Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8} accessibilityRole="button" className="flex-row items-center gap-1 active:opacity-70">
            {open ? <EyeOff size={15} color={BRAND} /> : <Eye size={15} color={BRAND} />}
            <Text className="text-sm font-semibold text-purple-700">{t(open ? "common.hide" : "common.view")}</Text>
          </Pressable>
          <Pressable onPress={() => void download()} disabled={saving} hitSlop={8} accessibilityRole="button" className="flex-row items-center gap-1 active:opacity-70">
            {saving ? <Spinner /> : <Download size={15} color={BRAND} />}
            <Text className="text-sm font-semibold text-purple-700">{t("common.download")}</Text>
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" className="flex-row items-center gap-1 active:opacity-70">
            <Trash2 size={15} color={DANGER} />
            <Text className="text-sm font-semibold" style={{ color: DANGER }}>
              {t("common.delete")}
            </Text>
          </Pressable>
        </View>
      </Card>
      {open ? (
        // collapsable={false}: Android must keep this wrapper as a real view to capture it.
        <View ref={cardRef} collapsable={false}>
          {renderCard()}
        </View>
      ) : null}
    </View>
  );
}

/** "vagewell-<kind>-YYYY-MM-DD-HHMM.png" in local time. */
export function libraryFileName(kind: "meal" | "report", iso: string): string {
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, "0");
  return `vagewell-${kind}-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.png`;
}
