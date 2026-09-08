import { notify, type NotifyApi } from "./notify";

/**
 * The mobile toast surface injected into the shared data layer via
 * configureCore(). Backed by the centered-dialog NotificationHost (see
 * lib/notify.ts) rather than sonner-native, so every `toast.*` call — from
 * shared mutations and from screens alike — surfaces as the same centered
 * box of text. Typed as NotifyApi (ToastApi + `warning`); `configureCore`
 * only reads the `success`/`error` it needs.
 */
export const toast: NotifyApi = notify;
