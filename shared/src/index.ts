/**
 * @vagewell/shared — platform-neutral contract + data layer.
 * Consumed by the Next.js web app and the Expo mobile app.
 * Each app calls configureCore({ supabase, toast }) once at startup.
 */
export * from "./types";
export * from "./constants";
export * from "./phone";
export * from "./dates";
export * from "./format";
export * from "./schemas";
export * from "./queryClient";
export * from "./runtime";
export * from "./hooks";
export * from "./mutations";
