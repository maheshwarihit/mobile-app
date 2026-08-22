import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Toaster } from "sonner-native";
import * as WebBrowser from "expo-web-browser";
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
import { LanguageProvider } from "@/lib/i18n";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useThemePreference } from "@/hooks/useThemePreference";
import "./global.css";

// Inject the mobile platform implementations into the shared data layer (once).
configureCore({ supabase, toast });
const queryClient = makeQueryClient();
// Required by expo-web-browser (lib/oauth.ts's WebBrowser.openAuthSessionAsync)
// to cleanly dismiss the in-app browser once Google/Apple redirect back to
// the app — a documented no-op on web, where there's no such session to close.
WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [fontsLoaded] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });
  // Forces NativeWind's colorScheme to "light" by default (persisted
  // preference wins if the admin sidebar's toggle was ever used) — without
  // this running somewhere every screen actually mounts through, a device
  // with system dark mode on silently falls back to it, and every `dark:`
  // Tailwind variant across the app (never designed for the customer-facing
  // screens) bleeds through unintentionally. Previously only called inside
  // AdminSidebar, so it never ran at all for anyone who never opened that
  // screen — every patient, and every ops user before their first visit
  // there.
  useThemePreference();

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
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
              {/* closeButton: a manual X on every toast — belt-and-braces so an
                  error is always dismissible by hand, not just by its 4s
                  auto-close timer. */}
              <Toaster closeButton />
              <StatusBar style="dark" />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
