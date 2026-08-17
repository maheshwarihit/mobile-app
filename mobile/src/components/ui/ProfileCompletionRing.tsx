import { View, Text, Pressable } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { BRAND } from "@/theme";

/**
 * Naukri-style circular completion indicator — grey track, brand-teal
 * progress arc, percentage centered inside. Extracted from `ServicesScreen`'s
 * original `ProfileCompletionButton` (which only ever showed the signed-in
 * patient's own completion) so `OpsClientsScreen` can show a *client's*
 * completion the same way instead of a bare "25%" text label. `onPress` is
 * optional — omit it for a read-only display (e.g. in a list row).
 */
export function ProfileCompletionRing({
  percent,
  size = 44,
  stroke = 3,
  onPress,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  onPress?: () => void;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const ring = (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={BRAND}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={{ fontSize: Math.max(8, Math.round(size * 0.22)) }} className="font-bold text-gray-700">
        {clamped}%
      </Text>
    </View>
  );

  if (!onPress) return ring;
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      {ring}
    </Pressable>
  );
}
