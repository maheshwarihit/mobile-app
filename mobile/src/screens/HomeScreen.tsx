import { useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stethoscope, PhoneCall, ArrowRight } from "lucide-react-native";
import { PrimaryButton, OutlineButton, GradientButton, Card } from "@/components/ui";
import { AuthModal } from "@/components/feature/AuthModal";
import { LanguageToggle } from "@/components/feature/LanguageToggle";
import { translateServiceName, translateServiceDescription } from "@/lib/serviceI18n";
import { ServiceDescription } from "@/components/feature/ServiceDescription";
import { useLanguage } from "@/lib/i18n";
import { BRAND } from "@/theme";
import { SEED_SERVICES, money, HOSPITAL_CONTACT_PHONE } from "@vagewell/shared";

/**
 * Unauthenticated home page: a short services teaser (static `SEED_SERVICES`
 * copy, not a live query — the `services` table isn't grantable to an
 * unauthenticated request, and this content doesn't need to be live-updated
 * before someone even has an account). Signing in/up happens in a centered
 * popup over this page rather than a separate screen; once authenticated,
 * RootNavigator swaps straight to the normal tabs, where the live Services
 * screen (already tap-to-book) is the real booking entry point.
 */
export function HomeScreen() {
  const { t } = useLanguage();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  const open = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-6 pb-8 pt-4">
        <View className="mb-4 flex-row justify-end">
          <LanguageToggle />
        </View>

        <Card className="mb-6 p-6">
          <Text className="text-2xl font-bold text-gray-900">{t("home.createAccount.title")}</Text>
          <Text className="mt-2 text-base text-gray-500">{t("home.createAccount.subtitle")}</Text>
          <View className="mt-5">
            <GradientButton fullWidth onPress={() => open("register")}>
              {t("home.createAccount.cta")}
            </GradientButton>
          </View>
        </Card>

        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-gray-900">{t("home.ourServices")}</Text>
          <Pressable
            onPress={() => Linking.openURL(`tel:${HOSPITAL_CONTACT_PHONE}`)}
            className="h-10 w-10 items-center justify-center rounded-full bg-purple-50 active:opacity-70"
          >
            <PhoneCall size={18} color={BRAND} />
          </Pressable>
        </View>

        <View className="gap-3">
          {SEED_SERVICES.map((s) => (
            <Pressable key={s.name} onPress={() => open("register")} className="active:opacity-70">
              <Card className="p-4">
                <View className="flex-row items-start gap-3">
                  <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                    <Stethoscope size={18} color={BRAND} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">{translateServiceName(t, s.name)}</Text>
                    <ServiceDescription text={translateServiceDescription(t, s.description)} />
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        <View className="mt-3 rounded-xl bg-[#63A147] p-4">
          <Text className="text-center text-sm font-bold text-white">
            {t("services.pricesFromNote", { price: money(Math.min(...SEED_SERVICES.map((s) => s.price_per_day))) })}
          </Text>
        </View>

        <View className="mt-6 gap-3">
          <PrimaryButton fullWidth icon={ArrowRight} onPress={() => open("register")}>
            {t("home.getStartedBookCare")}
          </PrimaryButton>
          <OutlineButton fullWidth onPress={() => open("login")}>
            {t("home.existingUserLogin")}
          </OutlineButton>
        </View>
      </ScrollView>

      {/* Keyed on authMode: AuthModal's internal mode state is set once from
          initialMode at mount and doesn't react to later prop changes (the
          modal itself isn't unmounted when visible flips to false), so
          without this key, tapping "Existing user — Login" first would open
          the modal on whichever mode last mounted rather than the one just
          requested. */}
      <AuthModal key={authMode} visible={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </SafeAreaView>
  );
}
