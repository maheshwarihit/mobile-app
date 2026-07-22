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
 * The profileLoading splash gate avoids a flicker to the patient shell before
 * the role resolves.
 */
export function RootNavigator() {
  const { user, loading, profileLoading, role } = useAuth();
  if (loading || (user && profileLoading)) return <SplashScreen />;
  if (!user) return <AuthNavigator />;
  const isStaff = role === "staff" || role === "admin";
  return isStaff ? <AdminNavigator /> : <AppNavigator />;
}
