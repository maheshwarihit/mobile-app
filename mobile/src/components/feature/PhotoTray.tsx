import { View, Text, Image, Pressable, ScrollView } from "react-native";
import { X } from "lucide-react-native";
import { useLanguage } from "@/lib/i18n";

/**
 * The photos gathered so far for one analysis — report pages or photos of one
 * meal — as numbered thumbnails in order, each with a remove ✕.
 */
export function PhotoTray({ uris, hint, onRemove }: { uris: string[]; hint: string; onRemove: (index: number) => void }) {
  const { t } = useLanguage();
  return (
    <View className="gap-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {uris.map((uri, i) => (
          <View key={`${uri}-${i}`} className="overflow-hidden rounded-lg bg-gray-100" style={{ width: 72, height: 96 }}>
            <Image source={{ uri }} resizeMode="cover" style={{ width: 72, height: 96 }} />
            <View className="absolute bottom-1 left-1 h-5 w-5 items-center justify-center rounded-full bg-black/60">
              <Text className="text-[11px] font-bold text-white">{i + 1}</Text>
            </View>
            <Pressable
              onPress={() => onRemove(i)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t("common.remove")}
              className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60 active:opacity-70"
            >
              <X size={14} color="#ffffff" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <Text className="text-xs text-gray-500">{hint}</Text>
    </View>
  );
}
