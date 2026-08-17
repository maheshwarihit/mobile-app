import { View, Text, ActivityIndicator } from "react-native";
import { BRAND } from "@/theme";

export function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-authbg">
      <Text className="mb-4 text-2xl font-bold text-gray-900">VAgeWell Care</Text>
      <ActivityIndicator color={BRAND} />
    </View>
  );
}
