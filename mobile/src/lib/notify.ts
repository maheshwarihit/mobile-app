import type { ToastApi } from "@vagewell/shared";

/**
 * App-wide notification bus. Replaces sonner-native's edge toasts with a
 * single centered dialog card (see components/ui/NotificationHost) so a
 * notification reads as the same kind of box as every other dialog in the
 * app, in the middle of the screen rather than jammed against the top edge.
 *
 * The public surface is a superset of `ToastApi` (`success` / `error`, plus
 * `warning` which sonner-native also exposed and one ops screen uses), so it
 * drops straight into `configureCore({ toast })` and every existing `toast.*`
 * call site keeps working unchanged.
 */
export type NoticeKind = "success" | "error" | "warning";

export interface Notice {
  kind: NoticeKind;
  message: string;
  /** Repeated calls with the same id replace the current notice instead of queueing a duplicate. */
  id?: string;
  /** Monotonic key so the host re-renders even for an identical message. */
  key: number;
}

export interface NotifyApi extends ToastApi {
  warning: (message: string, opts?: { id?: string }) => void;
}

type Listener = (n: Notice) => void;

let listener: Listener | null = null;
let seq = 0;

/** Called by NotificationHost when it mounts. Only one host is expected. */
export function subscribeNotices(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

function push(kind: NoticeKind, message: string, opts?: { id?: string }) {
  seq += 1;
  listener?.({ kind, message, id: opts?.id, key: seq });
}

export const notify: NotifyApi = {
  success: (message, opts) => push("success", message, opts),
  error: (message, opts) => push("error", message, opts),
  warning: (message, opts) => push("warning", message, opts),
};
