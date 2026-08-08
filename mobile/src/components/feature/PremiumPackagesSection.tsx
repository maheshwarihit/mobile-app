import { View, Text, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import { Card } from "@/components/ui";
import { PACKAGES } from "@/lib/packages";

/**
 * Silver/Gold/Platinum teaser — shared between the pre-login HomeScreen and
 * the post-login ServicesScreen so both stay in sync. Marketing-only (see
 * `PACKAGES`' own TODO) — `onPressPackage` is whatever the calling screen's
 * "I want this" action already is (opening the sign-up modal, or navigating
 * to Appointment), since there's no real per-tier product to link to yet.
 */
export function PremiumPackagesSection({ onPressPackage }: { onPressPackage: () => void }) {
  return (
    <View>
      <View className="mb-4">
        <Text className="text-lg font-bold text-gray-900">Premium packages</Text>
        <Text className="mt-0.5 text-xs text-gray-400">Preview — final pricing & benefits to be confirmed.</Text>
      </View>
      <View className="gap-3">
        {PACKAGES.map((p) => (
          <Pressable key={p.tier} onPress={onPressPackage} className="active:opacity-70">
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
    </View>
  );
}
