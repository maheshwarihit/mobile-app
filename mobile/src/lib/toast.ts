import { toast as sonner } from "sonner-native";
import type { ToastApi } from "@vagewell/shared";

/** Adapts sonner-native to the shared ToastApi injected via configureCore(). */
export const toast: ToastApi = {
  success: (message) => sonner.success(message),
  error: (message) => sonner.error(message),
};
