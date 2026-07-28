import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLogo, PrimaryButton, OutlineButton } from "@/components/ui";
import type { AuthScreenProps } from "@/navigation/types";

const QUOTES = [
  "“Take care of your body. It's the only place you have to live.” — Jim Rohn",
  "“Health is not valued until sickness comes.” — Thomas Fuller",
  "“The greatest wealth is health.” — Virgil",
  "“Prevention is better than cure.”",
];

export function LandingScreen({ navigation }: AuthScreenProps<"Landing">) {
  const [qi, setQi] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setQi((i) => (i + 1) % QUOTES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-authbg">
      <View className="flex-1 justify-center px-6">
        <View className="mb-8 items-center">
          <View className="mb-4">
            <BrandLogo size={72} />
          </View>
          <Text className="text-3xl font-bold text-purple-600">
            VAgeWell <Text className="text-gray-900">CARE</Text>
          </Text>
          <Text className="mt-2 text-center text-base text-gray-600">Care that comes to you</Text>
          <Text className="mt-5 min-h-[36px] px-2 text-center text-xs italic text-gray-500">{QUOTES[qi]}</Text>
        </View>

        <View className="gap-3">
          <PrimaryButton fullWidth onPress={() => navigation.navigate("Login")}>
            Existing user — Login
          </PrimaryButton>
          <OutlineButton fullWidth onPress={() => navigation.navigate("Register")}>
            New user — Register
          </OutlineButton>
        </View>
      </View>
    </SafeAreaView>
  );
}
