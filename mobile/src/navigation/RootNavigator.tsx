import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/providers/AuthProvider";
import type { AuthStackParamList } from "@/navigation/types";
import { SplashScreen } from "@/screens/SplashScreen";
import { LandingScreen } from "@/screens/LandingScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { RegisterScreen } from "@/screens/RegisterScreen";
import { AppNavigator } from "@/navigation/AppNavigator";

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
 * One session tree. After verifyOtp the session flips, the profile loads,
 * and the shell swaps automatically:
 *   signed out → AuthNavigator
 *   any role   → AppNavigator (tabs)
 * Any account — patient, staff, admin, or leaf_node — can use this app to
 * book/manage care for themselves or dependents; a staff/admin/leaf_node
 * phone number is not restricted to the web portal only (user decision,
 * 2026-07-31 — a role no longer blocks the mobile app; the web portal is a
 * separate capability on top, not an exclusive one). Booking/family/health-
 * record RLS was never role-gated to begin with (it scopes by
 * `account_id = auth.uid()`/household, not by role) — this only removes a
 * client-side UI wall that had no matching server-side restriction anyway.
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
  const { user, profile, loading, profileLoading } = useAuth();
  const profileResolved = !!profile && profile.id === user?.id;
  if (loading || (user && profileLoading && !profileResolved)) return <SplashScreen />;
  if (!user) return <AuthNavigator />;
  return <AppNavigator />;
}
