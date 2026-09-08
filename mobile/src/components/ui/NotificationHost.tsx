import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react-native";
import { ACCENT_GREEN, DANGER, WARN } from "@/theme";
import { subscribeNotices, type Notice } from "@/lib/notify";

/**
 * Renders app notifications (`toast.success` / `toast.error`) as one centered
 * dialog card — the same white rounded box, dark backdrop and fade as every
 * other dialog in the app (see ui/Modal.tsx) — instead of sonner-native's
 * slim strip against the top edge. Mounted once, near the root, in App.tsx.
 */
const AUTO_DISMISS_MS = 2600;

export function NotificationHost() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setNotice(null);
  };

  useEffect(() => {
    const unsub = subscribeNotices((n) => {
      if (timer.current) clearTimeout(timer.current);
      setNotice(n);
      timer.current = setTimeout(() => setNotice(null), AUTO_DISMISS_MS);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const kind = notice?.kind ?? "success";
  const Icon = kind === "error" ? AlertCircle : kind === "warning" ? AlertTriangle : CheckCircle2;
  const iconColor = kind === "error" ? DANGER : kind === "warning" ? WARN : ACCENT_GREEN;

  return (
    <Modal visible={!!notice} transparent animationType="fade" onRequestClose={clear}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={clear}>
        <Pressable className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5" onPress={() => {}}>
          <View className="flex-row items-start gap-3">
            <View className="mt-0.5">
              <Icon size={22} color={iconColor} />
            </View>
            <Text className="flex-1 text-base leading-6 text-gray-900">{notice?.message}</Text>
          </View>
          <View className="mt-4 flex-row justify-end">
            <Pressable onPress={clear} hitSlop={8} className="rounded-lg px-3 py-1.5 active:opacity-60">
              <Text className="text-sm font-semibold text-purple-700">OK</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
