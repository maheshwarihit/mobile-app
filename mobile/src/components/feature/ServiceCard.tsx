import { useRef, useState, useSyncExternalStore } from "react";
import { View, Text, Pressable, ScrollView, type LayoutChangeEvent } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useLanguage } from "@/lib/i18n";
import type { ServiceIconComponent } from "@/lib/serviceIcon";
import { BRAND } from "@/theme";

const shadow = { elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } };

// Every service card is as tall as the tallest one (the service with the
// longest feature list). Each card reports the height its own content needs —
// measured on the content blocks, never on the stretched card, so the shared
// height can't feed back into the measurement — and all cards use the largest.
let tallest = 0;
const listeners = new Set<() => void>();
const reportHeight = (h: number) => {
  if (h <= tallest) return;
  tallest = h;
  listeners.forEach((l) => l());
};
const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
const getTallest = () => tallest;

type Props = {
  /** Display name (translated). */
  name: string;
  /** "summary\n• feature\n• feature…" (translated). */
  description: string;
  icon: ServiceIconComponent;
  onPress: () => void;
};

/**
 * Service card with two sides you swipe between. Side 1: icon, name, summary.
 * Side 2: the "<service> includes" feature list. Tapping anywhere on either
 * side books. Swipe the card sideways, or use "View more" / "Back" (for a
 * mouse, which can't swipe), to move between sides. All cards share one height.
 */
export function ServiceCard({ name, description, icon: Icon, onPress }: Props) {
  const { t } = useLanguage();
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const minHeight = useSyncExternalStore(subscribe, getTallest, getTallest);
  // Natural heights of each side's two blocks (body + link).
  const parts = useRef({ body1: 0, link1: 0, body2: 0, link2: 0 });

  const [summary, ...lines] = description.split("\n").filter((l) => l.trim().length > 0);
  const features = lines.map((l) => l.replace(/^[•\s]+/, "").trim()).filter(Boolean);
  const hasFeatures = features.length > 0;

  const goTo = (p: number) => scroller.current?.scrollTo({ x: p * width, animated: true });
  const measure = (key: keyof typeof parts.current) => (e: LayoutChangeEvent) => {
    parts.current[key] = Math.ceil(e.nativeEvent.layout.height);
    const p = parts.current;
    reportHeight(Math.max(p.body1 + p.link1, p.body2 + p.link2));
  };

  return (
    <View
      style={shadow}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="overflow-hidden rounded-xl border border-gray-100 bg-white"
    >
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        scrollEnabled={hasFeatures}
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Each side is rendered only once the card has its real width: before
            that, text would wrap into a very tall column and be measured as
            the tallest. The two sides are separate children of the scroller,
            not grouped in a fragment — react-native-web wraps each direct
            child as one page, so a fragment would stack both in one page. */}
        {/* Side 1 — the service. */}
        {width > 0 ? (
            <Pressable onPress={onPress} style={{ width, minHeight }} className="justify-between active:opacity-80">
              <View onLayout={measure("body1")} className="flex-row items-start gap-3 p-4">
                <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                  <Icon size={18} color={BRAND} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">{name}</Text>
                  {summary ? <Text className="mt-0.5 text-sm text-gray-500">{summary}</Text> : null}
                </View>
              </View>
              {hasFeatures ? (
                <View onLayout={measure("link1")} className="pb-3 pl-[64px]">
                  <Pressable
                    onPress={() => goTo(1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    className="flex-row items-center gap-0.5 self-start active:opacity-70"
                  >
                    <Text className="text-sm font-semibold text-purple-700">{t("services.card.viewMore")}</Text>
                    <ChevronRight size={14} color={BRAND} />
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
        ) : null}

        {/* Side 2 — what the service includes. */}
        {width > 0 && hasFeatures ? (
              <Pressable
                onPress={onPress}
                style={{ width, minHeight }}
                className="justify-between bg-purple-50 active:opacity-80"
              >
                <View onLayout={measure("body2")} className="gap-1 p-4 pb-2">
                  <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: BRAND }}>
                    {t("services.card.includes", { name })}
                  </Text>
                  {features.map((f) => (
                    <Text key={f} className="text-sm text-gray-700">
                      • {f}
                    </Text>
                  ))}
                </View>
                <View onLayout={measure("link2")} className="pb-3 pl-4">
                  <Pressable
                    onPress={() => goTo(0)}
                    hitSlop={8}
                    accessibilityRole="button"
                    className="flex-row items-center gap-0.5 self-start active:opacity-70"
                  >
                    <ChevronLeft size={14} color={BRAND} />
                    <Text className="text-sm font-semibold text-purple-700">{t("common.back")}</Text>
                  </Pressable>
                </View>
              </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
