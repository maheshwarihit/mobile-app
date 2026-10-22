import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Animated, Easing } from "react-native";
import { Card } from "@/components/ui";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { BRAND } from "@/theme";
import logo from "../../../assets/logo.png";

type Props = {
  photoUri: string;
  /** What the analysis is doing, shown one after another as the percentage rises. */
  steps: TranslationKey[];
  /** About how long the analysis usually takes; the percentage is paced to it. */
  expectedMs: number;
  /** Photo shape: 1 for a plate, 3/4 for a report page. */
  aspectRatio?: number;
  /** "contain" keeps a whole report page in view; "cover" fills the square for a plate. */
  fit?: "cover" | "contain";
};

// The count eases towards this and waits there; the screen is replaced by the
// result the moment it arrives, since the real time always varies.
const CEILING = 95;

/**
 * Shared "analysing" screen for the Food Plate Monitor and Bio Markers: the
 * photo under a light veil with the VAgeWell logo, see-through and gently
 * pulsing, a percentage counting up, the current step, and a progress bar.
 */
export function AnalysisProgress({ photoUri, steps, expectedMs, aspectRatio = 1, fit = "cover" }: Props) {
  const { t } = useLanguage();
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setPercent(Math.round(value)));
    Animated.timing(progress, {
      toValue: CEILING,
      duration: expectedMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const beat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: false }),
      ]),
    );
    beat.start();
    return () => {
      progress.removeListener(id);
      progress.stopAnimation();
      beat.stop();
    };
  }, [progress, pulse, expectedMs]);

  const step = steps[Math.min(steps.length - 1, Math.floor((percent / CEILING) * steps.length))];

  return (
    <Card className="gap-3 overflow-hidden p-4">
      <View className="overflow-hidden rounded-xl bg-gray-100">
        <Image source={{ uri: photoUri }} resizeMode={fit} style={{ width: "100%", aspectRatio }} />
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.6)" }}>
          <Animated.Image
            source={logo}
            resizeMode="contain"
            style={{
              width: 110,
              height: 110,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }],
            }}
          />
          <Text className="mt-2 text-4xl font-extrabold" style={{ color: BRAND }}>
            {percent}%
          </Text>
        </View>
      </View>

      <Text className="text-center text-sm font-semibold text-gray-700">{t(step)}</Text>

      <View className="h-2 overflow-hidden rounded-full bg-gray-100">
        <View style={{ width: `${percent}%`, height: 8, borderRadius: 4, backgroundColor: BRAND }} />
      </View>
    </Card>
  );
}
