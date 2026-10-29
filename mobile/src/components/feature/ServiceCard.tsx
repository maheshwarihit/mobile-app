import { useRef, useState, useSyncExternalStore } from "react";
import { View, Text, Pressable, ScrollView, Image, StyleSheet, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useLanguage } from "@/lib/i18n";
import type { ServicePhoto } from "@/lib/serviceImage";
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

// The last real card size, so a card mounted again (coming Back to Services)
// draws at full size straight away instead of starting empty and growing —
// which made the list jump and the green price banner flash.
let knownWidth = 0;
let knownHeight = 0;

type Props = {
  /** Display name (translated). */
  name: string;
  /** "summary\n• feature\n• feature…" (translated). */
  description: string;
  /** Background photo for the whole card; text turns white over it. */
  image?: ServicePhoto;
  /** The app modules inside this service (translated), listed first on side 2. */
  modules?: string[];
  onPress: () => void;
};

// With a photo the card needs some height of its own to show it — more on a
// wide screen, where a short card would show only a thin strip of the picture.
const photoMinHeight = (cardWidth: number) => Math.min(300, Math.max(168, Math.round(cardWidth / 3.6)));
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Size and offset that fill a w×h card with the photo (like "cover"), but
 *  cropped around the photo's focus point instead of its centre. */
function coverAround(photo: ServicePhoto, w: number, h: number) {
  const height = Math.max(h, w / photo.aspect);
  const width = height * photo.aspect;
  return {
    position: "absolute" as const,
    width,
    height,
    left: clamp(w / 2 - photo.focus.x * width, w - width, 0),
    top: clamp(h / 2 - photo.focus.y * height, h - height, 0),
  };
}

/**
 * Service card with two sides you swipe between. Side 1: name and summary.
 * Side 2: the "<service> includes" feature list. Tapping anywhere on either
 * side books. Swipe the card sideways, or use "Know more" / "Back" (for a
 * mouse, which can't swipe), to move between sides. All cards share one height.
 */
export function ServiceCard({ name, description, image, modules = [], onPress }: Props) {
  const { t } = useLanguage();
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(knownWidth);
  const [height, setHeight] = useState(knownHeight);
  const tallestContent = useSyncExternalStore(subscribe, getTallest, getTallest);
  const minHeight = image ? Math.max(tallestContent, photoMinHeight(width)) : tallestContent;
  const onPhoto = !!image;
  const linkColor = onPhoto ? "#ffffff" : BRAND;
  const linkText = onPhoto ? "text-white" : "text-purple-700";
  // Natural heights of each side's two blocks (body + link).
  const parts = useRef({ body1: 0, link1: 0, body2: 0, link2: 0 });

  const [summary, ...lines] = description.split("\n").filter((l) => l.trim().length > 0);
  const features = lines.map((l) => l.replace(/^[•\s]+/, "").trim()).filter(Boolean);
  const hasFeatures = features.length > 0 || modules.length > 0;

  const goTo = (p: number) => scroller.current?.scrollTo({ x: p * width, animated: true });
  const measure = (key: keyof typeof parts.current) => (e: LayoutChangeEvent) => {
    parts.current[key] = Math.ceil(e.nativeEvent.layout.height);
    const p = parts.current;
    reportHeight(Math.max(p.body1 + p.link1, p.body2 + p.link2));
  };

  return (
    <View
      style={shadow}
      onLayout={(e) => {
        // A hidden screen (Services under an open page, on the web) reports 0×0;
        // keeping the last real size stops the cards collapsing and the list
        // jumping (the green price banner flashing up) when it is shown again.
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w > 0) setWidth((knownWidth = w));
        if (h > 0) setHeight((knownHeight = h));
      }}
      className="overflow-hidden rounded-xl border border-gray-100 bg-white"
    >
      {/* The photo sits still behind both sides; a dark wash that deepens
          towards the bottom, where the text sits, keeps the white text readable. */}
      {image && width > 0 && height > 0 ? (
        <>
          <Image source={image.source} resizeMode="cover" style={coverAround(image, width, height)} />
          <LinearGradient
            colors={["rgba(15,23,42,0.05)", "rgba(15,23,42,0.35)", "rgba(15,23,42,0.88)"]}
            locations={[0, 0.4, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}
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
            <Pressable onPress={onPress} style={{ width, minHeight }} className="justify-end active:opacity-80">
              {/* Name and summary sit at the bottom of the card, "Know more" bottom-right. */}
              <View onLayout={measure("body1")} className="px-4 pt-4">
                <Text className={`text-lg font-bold ${onPhoto ? "text-white" : "text-gray-900"}`}>{name}</Text>
                {summary ? <Text className={`mt-0.5 text-sm ${onPhoto ? "text-white" : "text-gray-500"}`}>{summary}</Text> : null}
              </View>
              {hasFeatures ? (
                <View onLayout={measure("link1")} className="px-4 pb-3 pt-1">
                  <Pressable
                    onPress={() => goTo(1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    className="flex-row items-center gap-0.5 self-end active:opacity-70"
                  >
                    <Text className={`text-sm font-semibold ${linkText}`}>{t("services.card.viewMore")}</Text>
                    <ChevronRight size={14} color={linkColor} />
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
        ) : null}

        {/* Side 2 — its modules in the app (if any), then what the service includes. */}
        {width > 0 && hasFeatures ? (
              <Pressable
                onPress={onPress}
                // Over a photo the feature list starts at the top, where the wash is
                // lightest, so this side gets an even dark layer of its own.
                style={[{ width, minHeight }, onPhoto ? { backgroundColor: "rgba(15,23,42,0.55)" } : null]}
                className={`justify-between active:opacity-80 ${onPhoto ? "" : "bg-purple-50"}`}
              >
                <View onLayout={measure("body2")} className="gap-1 p-4 pb-2">
                  {modules.length ? (
                    <>
                      <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: linkColor }}>
                        {t("services.card.modules", { name })}
                      </Text>
                      {modules.map((m) => (
                        <Text key={m} className={`text-sm font-semibold ${onPhoto ? "text-white" : "text-gray-900"}`}>
                          • {m}
                        </Text>
                      ))}
                    </>
                  ) : null}
                  {features.length ? (
                    <Text
                      className={`text-xs font-bold uppercase tracking-wide ${modules.length ? "mt-2" : ""}`}
                      style={{ color: linkColor }}
                    >
                      {t("services.card.includes", { name })}
                    </Text>
                  ) : null}
                  {features.map((f) => (
                    <Text key={f} className={`text-sm ${onPhoto ? "text-white" : "text-gray-700"}`}>
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
                    <ChevronLeft size={14} color={linkColor} />
                    <Text className={`text-sm font-semibold ${linkText}`}>{t("common.back")}</Text>
                  </Pressable>
                </View>
              </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
