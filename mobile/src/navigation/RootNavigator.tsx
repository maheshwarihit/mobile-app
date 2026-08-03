import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/providers/AuthProvider";
import type { AuthStackParamList } from "@/navigation/types";
import { SplashScreen } from "@/screens/SplashScreen";
import { LandingScreen } from "@/screens/LandingScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { RegisterScreen } from "@/screens/RegisterScreen";
import { AppNavigator } from "@/navigation/AppNavigator";
import { OutlineButton } from "@/components/ui";

const Auth = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <Auth.Navigator screenOptions={{ headerShown: false }}>
      <Auth.Screen name="Landing" component={LandingScreen} />
      <Auth.Screen name="Login" component={LoginScreen} />
      <Auth.Screen name="Register" component={RegisterScreen} />
    </Auth.Navigator>
  );
}

/**
 * This app is patient-only — staff/admin/leaf_node operate from the separate
 * web portal (web/). A phone number registered as one of those roles can
 * still complete the same Supabase OTP login here (one shared auth system —
 * a phone number can only ever be one account, a hard Supabase Auth
 * constraint, not something app code can change), so this is a clear dead
 * end rather than silently exposing the patient tabs to an ops account.
 * Reinstated 2026-07-31 after a brief reversal — user confirmed the original
 * separation (web-registered roles never usable in the mobile app) is what's
 * actually wanted, not a dual-role account. Now covers `leaf_node` too,
 * closing a gap the original version had (it only checked staff/admin).
 */
function StaffPortalNotice() {
  const { signOut } = useAuth();
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-authbg px-8">
      <Text className="mb-2 text-lg font-bold text-gray-900">Staff & admin portal moved</Text>
      <Text className="mb-6 text-center text-sm text-gray-600">
        Staff, admin, and leaf node accounts sign in from the VAgeWell Care web portal, not this app.
      </Text>
      <View className="w-full max-w-xs">
        <OutlineButton fullWidth onPress={signOut}>
          Sign out
        </OutlineButton>
      </View>
    </SafeAreaView>
  );
}

/**
 * One session tree. After verifyOtp the session flips, the profile (with
 * role) loads, and the shell swaps automatically:
 *   signed out            → AuthNavigator
 *   role patient          → AppNavigator (tabs)
 *   role staff|admin|leaf_node → StaffPortalNotice (this app is patient-only)
 * The splash gate avoids a flicker to the patient shell before the role
 * resolves — but only until the CURRENT user's profile first resolves. A
 * background refresh (saving the profile, an hourly TOKEN_REFRESHED event)
 * must NOT unmount the navigator: that rebuilds the tab stack from scratch
 * (dumping the user on the initial tab) and, on web, react-navigation writes
 * `document.title = undefined` while no navigator is mounted.
 * Keyed on profile.id === user.id so a stale profile from a previous account
 * doesn't count as resolved when a different-role account signs in.
 */
export function RootNavigator() {
  const { user, profile, loading, profileLoading, role } = useAuth();
  const profileResolved = !!profile && profile.id === user?.id;
  if (loading || (user && profileLoading && !profileResolved)) return <SplashScreen />;
  if (!user) return <AuthNavigator />;
  const isOpsRole = role === "staff" || role === "admin" || role === "leaf_node";
  return isOpsRole ? <StaffPortalNotice /> : <AppNavigator />;
}
