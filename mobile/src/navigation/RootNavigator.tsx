import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/lib/i18n";
import { SplashScreen } from "@/screens/SplashScreen";
import { ChooseLanguageScreen } from "@/screens/ChooseLanguageScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { LandingScreen } from "@/screens/LandingScreen";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { VerifyPhoneScreen } from "@/screens/VerifyPhoneScreen";
import { AppNavigator } from "@/navigation/AppNavigator";
import { AdminNavigator, CaregiverNavigator } from "@/navigation/OpsNavigator";

/**
 * One session tree, one app, three roles. After verifyOtp the session flips,
 * the profile loads, and the shell swaps automatically:
 *   signed out, no language picked yet   → ChooseLanguageScreen (EN/தமிழ், the true first
 *                                          screen — shown every time the app is opened signed
 *                                          out, same as onboarding below; not persisted)
 *   signed out, past language, hasn't seen onboarding → OnboardingScreen
 *                                          (shown every time the app is opened, for every user —
 *                                          not a persisted "once ever" flag; see the state below)
 *   signed out, past onboarding, not past Landing → LandingScreen (Get Started /
 *                                          View as Guest / Staff or Admin sign in)
 *   signed out, guest mode chosen        → HomeScreen (sign-in/up is still a popup on it)
 *   signed in, no verified phone         → VerifyPhoneScreen (only ever a Google sign-in — it
 *                                          hands back no phone at all; every account, however it
 *                                          started, must verify a real number via OTP before
 *                                          reaching its shell)
 *   role admin                           → AdminNavigator     (appointments, requests, clients, team)
 *   role leaf_node                       → CaregiverNavigator (my visits, clients)
 *   role patient                         → AppNavigator       (services, appointments, profile)
 *
 * Role decides the shell, not access: RLS is the real boundary in every case
 * (an admin's extra reach comes from is_admin() in the policies, not from
 * which tab bar they were handed). Routing here only avoids showing someone a
 * screen whose every action the server would reject.
 *
 * The one-time `CompleteProfileScreen` gate that used to stand in front of an
 * ops account is gone: it existed only because staff/admin accounts were being
 * dropped into the *patient* tabs and were missing age/gender/address. They now
 * land in their own shell, where those client-bio fields aren't used at all and
 * name/employee ID/address are editable from the Profile tab whenever they
 * like — so blocking the dashboard behind a bio form no longer buys anything.
 * (`screens/CompleteProfileScreen.tsx` is left in the tree but unreferenced.)
 *
 * The splash gate avoids a flicker to the wrong shell before the role resolves —
 * but only until the CURRENT user's profile first resolves. A background refresh
 * (saving the profile, an hourly TOKEN_REFRESHED event) must NOT unmount the
 * navigator: that rebuilds the tab stack from scratch (dumping the user on the
 * initial tab) and, on web, react-navigation writes `document.title = undefined`
 * while no navigator is mounted. Keyed on profile.id === user.id so a stale
 * profile from a previous account doesn't count as resolved when a
 * different-role account signs in.
 */
export function RootNavigator() {
  const { user, profile, loading, profileLoading, role } = useAuth();
  const { language } = useLanguage();
  // Plain in-memory state, not AsyncStorage — both the language pick and
  // onboarding are meant to show on every app open now, for every signed-out
  // session, so there's nothing to persist or reset. A fresh cold start
  // creates a fresh RootNavigator instance with these back at their initial
  // values, which is exactly what "every time the app opens" requires; no
  // async read/write, no dev-only reset control needed either. Nested inside
  // `!user` below (not checked before it) so an already-signed-in session
  // restored on refresh is never interrupted by either screen — same scoping
  // onboarding already had.
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  const profileResolved = !!profile && profile.id === user?.id;
  if (loading || (user && profileLoading && !profileResolved)) return <SplashScreen />;
  if (!user) {
    if (!language) return <ChooseLanguageScreen />;
    if (!onboardingDone) return <OnboardingScreen onDone={() => setOnboardingDone(true)} />;
    if (!guestMode) return <LandingScreen onGuest={() => setGuestMode(true)} />;
    return <HomeScreen />;
  }
  // Only reachable via Google sign-in (phone+OTP signup always sets this at
  // creation) — `profile` is guaranteed resolved past the splash gate above,
  // but guard the null case anyway rather than assume it.
  if (profile && !profile.phone) return <VerifyPhoneScreen />;
  if (role === "admin") return <AdminNavigator />;
  if (role === "leaf_node") return <CaregiverNavigator />;
  return <AppNavigator />;
}
