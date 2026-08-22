import { useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Check } from "lucide-react-native";
import { GradientButton, BrandLogo } from "@/components/ui";
import { useLanguage, type Language } from "@/lib/i18n";

const bgPhoto = require("../../assets/onboarding/image1.png.png");

/**
 * First screen shown every time the app is opened signed out, before
 * Onboarding — picks English or Tamil. Not persisted (see LanguageContext):
 * a fresh app open always starts with `language` back at null, so this
 * reappears every time, same as onboarding right after it. The EN/தமிழ்
 * dropdown on Onboarding/Landing/Home switches it again mid-session without
 * needing to come back here.
 *
 * Tapping an option only previews the pick (local `selected` state) — it must
 * NOT call the real `setLanguage` directly, since RootNavigator re-renders the
 * instant `language` stops being null and would skip straight past this
 * screen before Continue is ever pressed. Only Continue commits.
 */
export function ChooseLanguageScreen() {
  const { setLanguage, t } = useLanguage();
  const [selected, setSelected] = useState<Language>("en");

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <Image
        source={bgPhoto}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="cover"
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(2,10,13,0.55)", "rgba(2,10,13,0.94)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View className="flex-row items-center gap-3 px-6 pt-2">
          <BrandLogo size={52} transparent />
          <Text className="text-xl font-extrabold tracking-tight text-white">VAgeWell Care</Text>
        </View>

        <View className="flex-1 justify-end px-8 pb-6">
          <Text className="text-4xl font-extrabold leading-tight text-white">{t("chooseLanguage.titleLine1")}</Text>
          <Text className="text-4xl font-extrabold leading-tight text-teal-300">
            {t("chooseLanguage.titleLine2")}
          </Text>
          <Text className="mt-3 text-base text-gray-300">{t("chooseLanguage.subtitle")}</Text>
        </View>

        <View className="gap-3 px-6 pb-8">
          <LanguageOption
            label={t("chooseLanguage.english")}
            selected={selected === "en"}
            onPress={() => setSelected("en")}
          />
          <LanguageOption
            label={t("chooseLanguage.tamil")}
            selected={selected === "ta"}
            onPress={() => setSelected("ta")}
          />
          <View className="mt-2">
            <GradientButton fullWidth onPress={() => setLanguage(selected)}>
              {t("common.continue")}
            </GradientButton>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function LanguageOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between rounded-xl border px-5 py-4 ${
        selected ? "border-teal-400 bg-teal-400/10" : "border-white/20 bg-white/5"
      }`}
    >
      <Text className={`text-base font-semibold ${selected ? "text-teal-200" : "text-gray-200"}`}>{label}</Text>
      <View
        className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
          selected ? "border-teal-400 bg-teal-400" : "border-gray-400"
        }`}
      >
        {selected ? <Check size={14} color="#04141A" /> : null}
      </View>
    </Pressable>
  );
}
