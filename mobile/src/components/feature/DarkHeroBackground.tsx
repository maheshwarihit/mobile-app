import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BRAND, BRAND_DARK } from "@/theme";

/**
 * Full-bleed teal gradient + a darkening scrim toward the bottom, used behind
 * Onboarding and Landing. Stands in for a photographic background — this app
 * ships no licensed photography, so instead of faking one it matches the
 * *visual system* the reference design uses a photo to create: a rich
 * full-bleed backdrop, darkest where the headline/buttons sit, so light text
 * stays legible without a separate solid card behind it.
 */
export function DarkHeroBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/*
        pointerEvents="none" is set on EACH LinearGradient directly, not just
        this wrapping View. LinearGradient renders its own native view (a
        custom Android drawing surface, not a plain RN View), and a parent's
        pointerEvents="none" — a JS-level convenience RN compiles down to a
        touch-handling flag per native view — does not reliably cascade into
        a third-party native component's own view the way it does into a
        plain nested View. Left un-set on the child, this gradient can end up
        the frontmost thing Android's touch dispatch sees, silently
        swallowing every tap on top of it with zero visual feedback (no
        active-opacity flash, nothing) — exactly the symptom this was fixed
        for: every button on both Onboarding and Landing (the two screens
        that render this background) went completely dead on a real Android
        device despite working correctly in every browser-based test.
      */}
      <LinearGradient
        pointerEvents="none"
        colors={[BRAND, BRAND_DARK, "#071B22"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(2,10,13,0.55)", "rgba(2,10,13,0.92)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
