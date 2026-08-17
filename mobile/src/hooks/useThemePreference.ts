import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";

const THEME_KEY = "vagewell.colorScheme";

/**
 * Wraps NativeWind's own `useColorScheme()` (which drives every `dark:`
 * Tailwind variant across the app — real, not decorative) with persistence,
 * so the admin's Light/Dark pick in the sidebar survives an app restart.
 * NativeWind's own state is in-memory only; nothing else in this project
 * reads/writes AsyncStorage under this key.
 */
export function useThemePreference() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let initial: "light" | "dark" = "light";
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved === "light" || saved === "dark") initial = saved;
      } catch {
        // best-effort — falls through to the "light" default below
      }
      // On web, NativeWind detects its own `darkMode: "class"` CSS flag
      // *asynchronously* — a MutationObserver watches for the compiled
      // stylesheet to land in <head>, since the flag itself travels as a CSS
      // custom property (`--css-interop-darkMode`) (see
      // react-native-css-interop's runtime/web/color-scheme.js). Calling
      // setColorScheme() before that observer fires updates NativeWind's
      // internal state but never touches the actual `.dark` class on <html>,
      // and worse, silently falls back to following the OS's
      // prefers-color-scheme instead of the explicit value — permanently
      // disagreeing with what's actually rendered. This tiny delay lets that
      // detection finish first so the very first explicit call is the one
      // that actually sticks.
      await new Promise((resolve) => setTimeout(resolve, 60));
      if (!cancelled) {
        setColorScheme(initial);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = colorScheme === "dark" ? "light" : "dark";
    setColorScheme(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  };

  return { colorScheme, toggle, ready, toggleColorScheme };
}
