import { useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { BrandLogo, GradientButton, TranslucentButton } from "@/components/ui";
import { AuthModal } from "@/components/feature/AuthModal";
import { VisitAsModal, type VisitAs } from "@/components/feature/VisitAsModal";
import { LanguageToggle } from "@/components/feature/LanguageToggle";
import { useLanguage } from "@/lib/i18n";

const landingPhoto = require("../../assets/onboarding/image5.png.png");

/**
 * SCREEN_ID: LANDING — the screen after onboarding, shown every time the app
 * is opened signed out and the carousel has been gotten past for this app
 * session (neither screen persists anything — both reappear on every cold
 * start until the device actually signs in; see RootNavigator).
 *
 * Three doors, matching the app's three roles:
 *   "Get Started"             → opens the "Visit as" picker (Care Seeker /
 *                                Caregiver·Admin) intending a new sign-up.
 *   "View as Guest"           → skip auth entirely and browse HomeScreen's
 *                                services/packages teaser; that screen's own
 *                                "Get Started"/"Existing user — Login"
 *                                buttons are still there if they change
 *                                their mind partway through browsing.
 *   "Already have account? Log In" → opens the SAME "Visit as" picker,
 *                                intending a login instead. A returning
 *                                caregiver/admin taps this exactly as often
 *                                as a returning client does, so it can't skip
 *                                straight to the client form the way an
 *                                earlier round of this screen did — that
 *                                silently sent a caregiver/admin to the wrong
 *                                door. Both doors' initial tab (Login vs Sign
 *                                up) depend on which of these two buttons was
 *                                tapped, same as the Care Seeker path.
 *
 * The Caregiver·Admin door now also offers Sign up, with an Admin/Care Giver
 * role picker (`AuthModal`'s `rolePicker` prop) — anyone completing OTP there
 * can pick a role and get it immediately, no approval step (see the
 * `handle_new_user()` DB trigger, migration 0013). This was a deliberate
 * reversal of the earlier "caregiver/admin is login-only, promotion-only"
 * decision (2026-08-10) — the user explicitly re-confirmed self-signup for
 * both roles including Admin.
 *
 * Whichever door someone taps only decides which *form* they see next —
 * RootNavigator routes to the client/caregiver/admin shell after login based
 * on the account's real `profiles.role`, not on which button was tapped.
 */
export function LandingScreen({ onGuest }: { onGuest: () => void }) {
  const { t } = useLanguage();
  const [visitAsOpen, setVisitAsOpen] = useState(false);
  // What "Care Seeker" should open as once picked — register from Get
  // Started, login from Log In. Caregiver·Admin ignores this entirely.
  const [visitAsIntent, setVisitAsIntent] = useState<"login" | "register">("register");
  const [clientAuthOpen, setClientAuthOpen] = useState(false);
  const [clientAuthMode, setClientAuthMode] = useState<"login" | "register">("register");
  const [staffAuthOpen, setStaffAuthOpen] = useState(false);
  const [staffAuthMode, setStaffAuthMode] = useState<"login" | "register">("login");

  const openVisitAs = (intent: "login" | "register") => {
    setVisitAsIntent(intent);
    setVisitAsOpen(true);
  };

  const openClientAuth = (mode: "login" | "register") => {
    setClientAuthMode(mode);
    setClientAuthOpen(true);
  };

  const handleVisitAs = (choice: VisitAs) => {
    setVisitAsOpen(false);
    if (choice === "care_seeker") openClientAuth(visitAsIntent);
    else {
      setStaffAuthMode(visitAsIntent);
      setStaffAuthOpen(true);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      {/* Same full-bleed photo + scrim pattern as OnboardingScreen: the image
          needs explicit width/height (not just StyleSheet.absoluteFill) to
          actually stretch on web — a CSS replaced element like <img> keeps
          its own intrinsic size otherwise, even when absolutely positioned
          with all four insets at 0. */}
      <Image
        source={landingPhoto}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="cover"
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(2,10,13,0.5)", "rgba(2,10,13,0.92)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between px-6 pt-2">
          <View className="flex-row items-center gap-3">
            <BrandLogo size={52} transparent />
            <Text className="text-xl font-extrabold tracking-tight text-white">{t("landing.brand")}</Text>
          </View>
          <LanguageToggle dark />
        </View>

        <View className="flex-1 justify-end px-8 pb-4">
          <Text className="text-3xl font-bold leading-tight text-white">
            {t("landing.titleBefore")}
            <Text className="text-teal-300">{t("landing.titleHighlight")}</Text>
          </Text>
          <Text className="mt-3 text-base text-gray-300">{t("landing.subtitle")}</Text>
        </View>

        <View className="gap-3 px-6 pb-8">
          <GradientButton fullWidth icon={ArrowRight} onPress={() => openVisitAs("register")}>
            {t("landing.getStarted")}
          </GradientButton>
          <TranslucentButton fullWidth onPress={onGuest}>
            {t("landing.viewAsGuest")}
          </TranslucentButton>
          <Pressable onPress={() => openVisitAs("login")} hitSlop={8} className="items-center pt-2 active:opacity-70">
            <Text className="text-sm text-gray-300">
              {t("landing.alreadyHaveAccount")}
              <Text className="font-semibold text-teal-300">{t("landing.logIn")}</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <VisitAsModal visible={visitAsOpen} onClose={() => setVisitAsOpen(false)} onContinue={handleVisitAs} />

      {/* Keyed on clientAuthMode: AuthModal's internal mode state is set once
          from initialMode at mount and doesn't react to later prop changes,
          so without this key, "Log In" after a "Get Started" tap (or vice
          versa) would open on whichever mode last mounted — see the same fix
          applied to HomeScreen's AuthModal usage. */}
      <AuthModal key={clientAuthMode} visible={clientAuthOpen} onClose={() => setClientAuthOpen(false)} initialMode={clientAuthMode} />
      <AuthModal
        key={`staff-${staffAuthMode}`}
        visible={staffAuthOpen}
        onClose={() => setStaffAuthOpen(false)}
        initialMode={staffAuthMode}
        allowModeSwitch
        rolePicker
        title={staffAuthMode === "login" ? t("auth.staffSignIn") : t("auth.staffSignUp")}
      />
    </View>
  );
}
