import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText } from "react-native-svg";
import { Card } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";
import type { BmiPoint } from "@/lib/bmiHistory";
import { ACCENT_GREEN, WARN, DANGER } from "@/theme";

// The four BMI ranges, as faint bands behind the line (same colours as the BMI scale).
const BANDS = [
  { from: 0, to: 18.5, color: "#60a5fa" },
  { from: 18.5, to: 25, color: ACCENT_GREEN },
  { from: 25, to: 30, color: WARN },
  { from: 30, to: 100, color: DANGER },
];
const LINE = "#1C7CBE";
const INK_MUTED = "#6b7280";
const GRID = "#e5e7eb";
const HEIGHT = 190;
const PAD = { left: 30, right: 14, top: 14, bottom: 26 };

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
};

/**
 * BMI over time for one person: a single line across the dates their height or
 * weight changed, over faint bands for the four BMI ranges. The latest value is
 * labelled; tapping a point shows its date and BMI.
 */
export function BmiTrendChart({ points }: { points: BmiPoint[] }) {
  const { t } = useLanguage();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  if (!points.length) return null;

  const values = points.map((p) => p.bmi);
  const yMin = Math.min(15, Math.floor(Math.min(...values) - 1));
  const yMax = Math.max(35, Math.ceil(Math.max(...values) + 1));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const last = points.length - 1;
  const shown = picked ?? last;
  // Date labels: every reading when there are few, otherwise first and last (so they never collide).
  const dateTicks = points.length <= 3 ? points.map((_, i) => i) : [0, last];

  return (
    <Card className="gap-2 p-4">
      <Text className="text-sm font-bold text-gray-900">{t("bmi.trend.title")}</Text>
      <Text className="text-xs text-gray-500">
        {t("bmi.trend.selected", { date: shortDate(points[shown].at), bmi: points[shown].bmi.toFixed(1) })}
      </Text>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {BANDS.map((b) => {
              const top = y(Math.min(b.to, yMax));
              const bottom = y(Math.max(b.from, yMin));
              return bottom > top ? (
                <Rect key={b.from} x={PAD.left} y={top} width={plotW} height={bottom - top} fill={b.color} opacity={0.12} />
              ) : null;
            })}
            {[18.5, 25, 30].map((v) =>
              v > yMin && v < yMax ? (
                <Line key={v} x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} strokeDasharray="3 3" />
              ) : null,
            )}
            {[18.5, 25, 30].map((v) =>
              v > yMin && v < yMax ? (
                <SvgText key={`l${v}`} x={PAD.left - 4} y={y(v) + 3} fontSize={10} fill={INK_MUTED} textAnchor="end">
                  {v}
                </SvgText>
              ) : null,
            )}
            {points.length > 1 ? (
              <Polyline
                points={points.map((p, i) => `${x(i)},${y(p.bmi)}`).join(" ")}
                fill="none"
                stroke={LINE}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {points.map((p, i) => (
              <Circle key={p.at} cx={x(i)} cy={y(p.bmi)} r={i === shown ? 6 : 4} fill={LINE} stroke="#ffffff" strokeWidth={2} />
            ))}
            {/* Only the latest value is labelled on the chart. */}
            <SvgText
              x={Math.min(x(last), PAD.left + plotW - 2)}
              y={y(points[last].bmi) - 10}
              fontSize={11}
              fontWeight="bold"
              fill="#111827"
              textAnchor={points.length === 1 ? "middle" : "end"}
            >
              {points[last].bmi.toFixed(1)}
            </SvgText>
            {dateTicks.map((i) => (
              <SvgText
                key={`d${i}`}
                x={x(i)}
                y={HEIGHT - 8}
                fontSize={10}
                fill={INK_MUTED}
                textAnchor={points.length === 1 ? "middle" : i === 0 ? "start" : i === last ? "end" : "middle"}
              >
                {shortDate(points[i].at)}
              </SvgText>
            ))}
          </Svg>
        ) : null}
        {/* Tap targets bigger than the dots. */}
        {width > 0
          ? points.map((p, i) => (
              <Pressable
                key={`t${p.at}`}
                onPress={() => setPicked(i)}
                accessibilityRole="button"
                accessibilityLabel={t("bmi.trend.selected", { date: shortDate(p.at), bmi: p.bmi.toFixed(1) })}
                style={{ position: "absolute", left: x(i) - 16, top: y(p.bmi) - 16, width: 32, height: 32 }}
              />
            ))
          : null}
      </View>
      {points.length === 1 ? <Text className="text-xs text-gray-500">{t("bmi.trend.one")}</Text> : null}

      {/* The full history as a list, newest first. */}
      <View className="mt-1 gap-1">
        <Text className="text-xs font-semibold text-gray-600">{t("bmi.trend.history")}</Text>
        {[...points].reverse().map((p) => (
          <View key={`row${p.at}`} className="flex-row items-center justify-between border-b border-gray-100 py-1.5">
            <Text className="text-xs text-gray-600">{shortDate(p.at)}</Text>
            <Text className="text-xs text-gray-600">
              {p.heightCm} cm · {p.weightKg} kg
            </Text>
            <Text className="text-xs font-bold text-gray-900">BMI {p.bmi.toFixed(1)}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
