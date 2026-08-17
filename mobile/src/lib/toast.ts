import { toast as sonner } from "sonner-native";
import type { ToastApi } from "@vagewell/shared";

/** Adapts sonner-native to the shared ToastApi injected via configureCore(). */
export const toast: ToastApi = {
  // Passing `id` makes a repeated call (e.g. retrying a failed upload)
  // update the existing toast in place — resetting its auto-dismiss timer —
  // instead of stacking a fresh duplicate every time, which is what made a
  // repeatedly-retried error look like it "never clears".
  success: (message, opts) => sonner.success(message, opts),
  error: (message, opts) => sonner.error(message, opts),
};
