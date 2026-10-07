import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { X } from "lucide-react-native";
import { ACCENT_GREEN } from "@/theme";

const ITEM_H = 40;
const VISIBLE_ROWS = 5;
const WHEEL_H = ITEM_H * VISIBLE_ROWS;
// Blank space above/below the list so the first and last rows can reach the centre band.
const EDGE_PAD = (WHEEL_H - ITEM_H) / 2;

/** The popup card shared by every wheel field: title, the wheel column(s) over a centre band, and Submit. */
export function WheelModal({
  visible,
  title,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: {
  visible: boolean;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable className="w-full max-w-xs rounded-2xl bg-white p-4 dark:bg-slate-900" onPress={() => {}}>
          <View className="mb-3 flex-row items-center justify-center">
            <Text className="text-xs font-semibold uppercase tracking-widest text-gray-900 dark:text-white">
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} className="absolute right-0">
              <X size={18} color="#9ca3af" />
            </Pressable>
          </View>

          <View style={{ height: WHEEL_H }}>
            <View
              pointerEvents="none"
              style={{ position: "absolute", left: 0, right: 0, top: EDGE_PAD, height: ITEM_H }}
              className="rounded-lg bg-gray-100 dark:bg-white/10"
            />
            <View className="flex-row">{children}</View>
          </View>

          <Pressable
            onPress={onSubmit}
            style={{ backgroundColor: ACCENT_GREEN }}
            className="mt-4 items-center rounded-xl py-3.5 active:opacity-80"
          >
            <Text className="text-xs font-bold uppercase tracking-widest text-white">{submitLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Wheel({
  items,
  index,
  onIndexChange,
}: {
  items: string[];
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const placed = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  // Scroll to the starting row once the list has a height; `scrollTo` before
  // that is a no-op on Android.
  const placeInitial = () => {
    if (placed.current) return;
    requestAnimationFrame(() => {
      ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
      placed.current = true;
    });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Ignore the y=0 event fired before the initial placement lands.
    if (!placed.current) return;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (i !== index) onIndexChange(i);
    // react-native-web has no `snapToInterval`, so snap by hand once scrolling goes quiet.
    if (Platform.OS === "web") {
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => ref.current?.scrollTo({ y: i * ITEM_H, animated: true }), 120);
    }
  };

  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1, height: WHEEL_H }}
      contentContainerStyle={{ paddingVertical: EDGE_PAD }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      scrollEventThrottle={16}
      nestedScrollEnabled
      onContentSizeChange={placeInitial}
      onScroll={onScroll}
    >
      {items.map((item, i) => {
        const distance = Math.abs(i - index);
        return (
          <Pressable
            key={item}
            onPress={() => ref.current?.scrollTo({ y: i * ITEM_H, animated: true })}
            style={{ height: ITEM_H, opacity: distance === 0 ? 1 : distance === 1 ? 0.55 : 0.25 }}
            className="items-center justify-center"
          >
            <Text
              className={
                distance === 0
                  ? "text-lg font-semibold text-gray-900 dark:text-white"
                  : distance === 1
                    ? "text-sm text-gray-700 dark:text-gray-200"
                    : "text-xs text-gray-700 dark:text-gray-200"
              }
            >
              {item}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
