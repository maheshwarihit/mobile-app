"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { Profile, Role } from "@vagewell/shared";
import { supabase } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // `.maybeSingle()` never throws on a DB-level error (permission denied, a
  // dropped column, ...) — it resolves with `{ data: null, error }`. Without
  // checking `error` here, a failed fetch looked identical to a slow one:
  // `profile` just stayed null forever and every consumer's "loading || no
  // profile yet" guard rendered the same eternal spinner, with nothing
  // anywhere surfacing what actually went wrong.
  const loadProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (error) {
        setProfile(null);
        setProfileError(error.message);
      } else {
        setProfile((data as Profile) ?? null);
        if (!data) setProfileError("No profile record exists for this account.");
      }
    } catch (e) {
      setProfile(null);
      setProfileError(e instanceof Error ? e.message : "Could not load your account.");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (u) await loadProfile(u.id);
  }, [loadProfile]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) await loadProfile(session.user.id);
      else setProfile(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setProfileError(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      profileLoading,
      profileError,
      refreshProfile,
      signOut,
    }),
    [user, profile, loading, profileLoading, profileError, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
