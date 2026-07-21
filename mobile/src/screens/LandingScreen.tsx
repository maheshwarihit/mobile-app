import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HeartPulse, CalendarCheck, ShieldCheck, Users } from "lucide-react-native";
import { PrimaryButton, OutlineButton } from "@/components/ui";
import type { AuthScreenProps } from "@/navigation/types";

const FEATURES = [
  { icon: CalendarCheck, text: "Book multi-day home care in minutes" },
  { icon: Users, text: "Manage care for yourself and your family" },
  { icon: ShieldCheck, text: "Upload payment proof securely" },
];

export function LandingScreen({ navigation }: AuthScreenProps<"Landing">) {
  return (
    <SafeAreaView className="flex-1 bg-authbg">
      <View className="flex-1 justify-center px-6">
        <View className="mb-10 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-purple-600">
            <HeartPulse size={32} color="#fff" />
          </View>
          <Text className="text-3xl font-bold text-gray-900">VAgeWell Care</Text>
          <Text className="mt-2 text-center text-base text-gray-600">
            Home-healthcare, booked from your phone.
          </Text>
        </View>

        <View className="mb-10 gap-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <View key={text} className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                <Icon size={18} color="#9333ea" />
              </View>
              <Text className="flex-1 text-sm text-gray-700">{text}</Text>
            </View>
          ))}
        </View>

        <View className="gap-3">
          <PrimaryButton fullWidth onPress={() => navigation.navigate("Register")}>
            Create an account
          </PrimaryButton>
          <OutlineButton fullWidth onPress={() => navigation.navigate("Login")}>
            Log in
          </OutlineButton>
        </View>
      </View>
    </SafeAreaView>
  );
}
