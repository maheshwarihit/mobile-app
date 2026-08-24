import Svg, { Circle, Path } from "react-native-svg";

/**
 * Original glyph (not traced from any reference image) of a figure mid
 * jumping-jack — arms raised out and up, legs spread — a clearly
 * "exercise"-read pose. Solid-silhouette style (thick round-capped strokes +
 * filled head), matching the app's other physio-icon iterations.
 */
export function PhysioIcon({ size = 24, color = "#000" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="4" r="2" fill={color} />
      {/* arms raised out and up */}
      <Path d="M10.5 6.8 L 6.5 2.5" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      <Path d="M13.5 6.8 L 17.5 2.5" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      {/* torso */}
      <Path d="M12 6.5 L 12 14" stroke={color} strokeWidth={3} strokeLinecap="round" />
      {/* legs spread */}
      <Path d="M12 14 L 6.8 21" stroke={color} strokeWidth={2.8} strokeLinecap="round" />
      <Path d="M12 14 L 17.2 21" stroke={color} strokeWidth={2.8} strokeLinecap="round" />
    </Svg>
  );
}
