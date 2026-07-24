import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Toaster } from "sonner-native";
import {
  useFonts,
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from "@expo-google-fonts/nunito-sans";
import { makeQueryClient, configureCore } from "@vagewell/shared";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { AuthProvider } from "@/providers/AuthProvider";
import { RootNavigator } from "@/navigation/RootNavigator";
import "./global.css";

// Inject the mobile platform implementations into the shared data layer (once).
configureCore({ supabase, toast });
const queryClient = makeQueryClient();

export default function App() {
  const [fontsLoaded] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/*
              documentTitle (web only): react-navigation's default formatter is
              `options?.title ?? route?.name`, which writes the literal string
              "undefined" into the browser tab whenever no navigator is mounted
              (cold-start splash, sign-out). Falling back to the app name also
              keeps internal route ids like "AdminMemberEdit" out of the tab.
            */}
            <NavigationContainer
              documentTitle={{ formatter: (options) => options?.title ?? "VAgeWell Care" }}
            >
              <RootNavigator />
            </NavigationContainer>
            <Toaster />
            <StatusBar style="dark" />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
