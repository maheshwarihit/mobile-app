import { View, Text, ActivityIndicator } from "react-native";

export function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-authbg">
      <Text className="mb-4 text-2xl font-bold text-purple-700">VAgeWell Care</Text>
      <ActivityIndicator color="#9810FA" />
    </View>
  );
}
