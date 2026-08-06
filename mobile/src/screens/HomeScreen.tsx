import { useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stethoscope, PhoneCall, ArrowRight, Award, Crown, Medal, Check } from "lucide-react-native";
import { BrandLogo, PrimaryButton, OutlineButton, Card } from "@/components/ui";
import { AuthModal } from "@/components/feature/AuthModal";
import { BRAND } from "@/theme";
import { SEED_SERVICES, money, HOSPITAL_CONTACT_PHONE } from "@vagewell/shared";

// TODO: placeholder tier names/pricing/benefits — marketing-only display for
// now (not a real bookable product, no DB backing). Confirm actual content
// with the client, then replace before this goes live for real customers.
const PACKAGES = [
  {
    tier: "Silver",
    icon: Medal,
    accent: { bg: "bg-gray-100", icon: "#6b7280", text: "text-gray-700" },
    price: "₹1,999/month",
    benefits: ["1 service of your choice", "Monthly progress check-in", "WhatsApp support"],
  },
  {
    tier: "Gold",
    icon: Award,
    accent: { bg: "bg-amber-50", icon: "#b45309", text: "text-amber-700" },
    price: "₹3,999/month",
    benefits: ["Any 2 services combined", "Priority scheduling", "Monthly health report"],
  },
  {
    tier: "Platinum",
    icon: Crown,
    accent: { bg: "bg-purple-50", icon: BRAND, text: "text-purple-700" },
    price: "₹6,999/month",
    benefits: ["All 4 services included", "Dedicated care coordinator", "24×7 priority support"],
  },
] as const;

/**
 * Unauthenticated home page: brand + a short services/package teaser (static
 * `SEED_SERVICES` copy, not a live query — the `services` table isn't
 * grantable to an unauthenticated request, and this content doesn't need to
 * be live-updated before someone even has an account) plus a placeholder
 * Premium Packages preview (`PACKAGES` above — marketing-only, not yet a
 * real bookable product). Signing in/up happens in a centered popup over
 * this page rather than a separate screen; once authenticated, RootNavigator
 * swaps straight to the normal tabs, where the live Services screen (already
 * tap-to-book) is the real booking entry point.
 */
export function HomeScreen() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  const open = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-6 pb-8 pt-4">
        <View className="mb-6 items-center">
          <View className="mb-3">
            <BrandLogo size={64} />
          </View>
          <Text className="text-3xl font-bold text-purple-600">
            VAgeWell <Text className="text-gray-900">CARE</Text>
          </Text>
          <Text className="mt-2 text-center text-base text-gray-600">Care that comes to you</Text>
        </View>

        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-gray-900">Our services</Text>
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
                    <Text className="text-base font-semibold text-gray-900">{s.name}</Text>
                    <Text className="mt-0.5 text-sm text-gray-500">{s.description}</Text>
                    <Text className="mt-1 text-sm font-semibold text-purple-700">
                      {s.pricing_model === "flat_advance"
                        ? `Advance ${money(s.price_per_day)} (monthly package)`
                        : `${money(s.price_per_day)}/day`}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        <View className="mb-4 mt-8">
          <Text className="text-lg font-bold text-gray-900">Premium packages</Text>
          <Text className="mt-0.5 text-xs text-gray-400">Preview — final pricing & benefits to be confirmed.</Text>
        </View>

        <View className="gap-3">
          {PACKAGES.map((p) => (
            <Pressable key={p.tier} onPress={() => open("register")} className="active:opacity-70">
              <Card className="p-4">
                <View className="flex-row items-start gap-3">
                  <View className={`mt-0.5 h-9 w-9 items-center justify-center rounded-lg ${p.accent.bg}`}>
                    <p.icon size={18} color={p.accent.icon} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-base font-semibold text-gray-900">{p.tier}</Text>
                      <Text className={`text-sm font-semibold ${p.accent.text}`}>{p.price}</Text>
                    </View>
                    <View className="mt-2 gap-1">
                      {p.benefits.map((b) => (
                        <View key={b} className="flex-row items-center gap-1.5">
                          <Check size={12} color="#9ca3af" />
                          <Text className="text-xs text-gray-500">{b}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        <View className="mt-6 gap-3">
          <PrimaryButton fullWidth icon={ArrowRight} onPress={() => open("register")}>
            Get Started — Book Care
          </PrimaryButton>
          <OutlineButton fullWidth onPress={() => open("login")}>
            Existing user — Login
          </OutlineButton>
        </View>
      </ScrollView>

      <AuthModal visible={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </SafeAreaView>
  );
}
