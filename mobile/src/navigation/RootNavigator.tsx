import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/providers/AuthProvider";
import type { AuthStackParamList } from "@/navigation/types";
import { SplashScreen } from "@/screens/SplashScreen";
import { LandingScreen } from "@/screens/LandingScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { RegisterScreen } from "@/screens/RegisterScreen";
import { AdminLoginScreen } from "@/screens/admin/AdminLoginScreen";
import { AdminOtpScreen } from "@/screens/admin/AdminOtpScreen";
import { AppNavigator } from "@/navigation/AppNavigator";
import { AdminNavigator } from "@/navigation/AdminNavigator";

const Auth = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <Auth.Navigator screenOptions={{ headerShown: false }}>
      <Auth.Screen name="Landing" component={LandingScreen} />
      <Auth.Screen name="Login" component={LoginScreen} />
      <Auth.Screen name="Register" component={RegisterScreen} />
      <Auth.Screen name="AdminLogin" component={AdminLoginScreen} />
      <Auth.Screen name="AdminOTP" component={AdminOtpScreen} />
    </Auth.Navigator>
  );
}

/**
 * One session tree, branched by role. After verifyOtp the session flips, the
 * profile (with role) loads, and the shell swaps automatically:
 *   signed out            → AuthNavigator (patient + Admin Portal entry)
 *   role patient          → AppNavigator (tabs)
 *   role staff | admin    → AdminNavigator (operations)
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
  const isStaff = role === "staff" || role === "admin";
  return isStaff ? <AdminNavigator /> : <AppNavigator />;
}
