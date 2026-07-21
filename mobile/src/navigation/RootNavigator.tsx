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
 * Replaces the web's middleware route-guard: the tree switches on the session.
 * After verifyOtp succeeds, onAuthStateChange flips `user` and RN swaps between
 * the auth stack and the app tabs automatically.
 */
export function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return user ? <AppNavigator /> : <AuthNavigator />;
}
