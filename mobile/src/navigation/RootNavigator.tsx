import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/providers/AuthProvider";
import type { AuthStackParamList } from "@/navigation/types";
import { SplashScreen } from "@/screens/SplashScreen";
import { LandingScreen } from "@/screens/LandingScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { RegisterScreen } from "@/screens/RegisterScreen";
import { CompleteProfileScreen } from "@/screens/CompleteProfileScreen";
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
 *   signed out                                → AuthNavigator
 *   ops role, never completed patient details  → CompleteProfileScreen
 *   any other case                             → AppNavigator (tabs)
 *
 * Any account — patient, staff, admin, or leaf_node — can use this app to
 * book/manage care for themselves or dependents, in addition to whatever
 * they do on the web portal (user decision, 2026-07-31 — a role no longer
 * blocks the mobile app outright). Booking/family/health-record RLS was
 * never role-gated to begin with (it scopes by `account_id = auth.uid()`/
 * household, not by role), so this only lets the mobile UI do what the
 * database already permitted.
 *
 * A staff/admin/leaf_node profile is created via the web portal's Register
 * page, which only ever collects Full Name + Mobile Number — age/gender/
 * address stay null forever unless something asks for them. The one-time
 * `CompleteProfileScreen` gate catches exactly that case (all three still
 * null) and blocks the normal tabs until they're filled in; an ordinary
 * patient signup already has these from the mobile Register screen, so the
 * gate never triggers for them.
 *
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
  const isOpsRole = role === "admin" || role === "leaf_node";
  const needsProfileCompletion =
    isOpsRole && !!profile && profile.age == null && profile.gender == null && profile.address == null;
  if (needsProfileCompletion) return <CompleteProfileScreen />;
  return <AppNavigator />;
}
