import { View, Text, Pressable } from "react-native";
import { MapPin, Eye } from "lucide-react-native";
import { useVisitPhotosForBooking, VISIT_PHOTO_BUCKET } from "@vagewell/shared";
import { useSignedUrl, openUrl } from "@/lib/signedUrl";
import { useLanguage } from "@/lib/i18n";

/** Status line showing whether the mandatory visit photo has been taken for
 * this booking, and — when GPS was captured — the actual location as a
 * tappable Google Maps link, not just an icon implying it exists. Shared by
 * MyVisitsScreen (the caregiver's own gate on Complete) and
 * AdminAppointmentsScreen (admin's read-only compliance check; no upload
 * action there, only whoever was actually at the visit takes it). Renders
 * nothing while no photo exists yet. */
export function VisitPhotoStatus({ bookingId }: { bookingId: string }) {
  const { t } = useLanguage();
  const { data: photos } = useVisitPhotosForBooking(bookingId);
  const latest = photos?.[0] ?? null;
  const { data: url } = useSignedUrl(VISIT_PHOTO_BUCKET, latest?.storage_path);

  if (!latest) return null;

  const hasLocation = latest.latitude != null && latest.longitude != null;
  const mapsUrl = hasLocation ? `https://www.google.com/maps?q=${latest.latitude},${latest.longitude}` : null;

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-1.5">
        <MapPin size={13} color={hasLocation ? "#059669" : "#9ca3af"} />
        <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t("ops.myVisits.visitPhoto.taken")}</Text>
        {url ? (
          <Pressable onPress={() => openUrl(url)} hitSlop={8} className="active:opacity-60">
            <Eye size={14} color="#4b5563" />
          </Pressable>
        ) : null}
      </View>
      {mapsUrl ? (
        <Pressable onPress={() => openUrl(mapsUrl)} className="active:opacity-60">
          <Text className="ml-[19px] text-[11px] text-blue-600 underline dark:text-blue-400">
            {t("ops.myVisits.visitPhoto.viewOnMap", {
              lat: latest.latitude!.toFixed(5),
              lng: latest.longitude!.toFixed(5),
            })}
          </Text>
        </Pressable>
      ) : (
        <Text className="ml-[19px] text-[11px] text-gray-400 dark:text-gray-500">{t("ops.myVisits.visitPhoto.noLocation")}</Text>
      )}
    </View>
  );
}
