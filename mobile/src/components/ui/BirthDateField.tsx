import { useEffect, useRef, useState } from "react";
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
import { Calendar, ChevronDown, X } from "lucide-react-native";
import { formatDateDMY } from "@vagewell/shared";
import { ACCENT_GREEN } from "@/theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ITEM_H = 40;
const VISIBLE_ROWS = 5;
const WHEEL_H = ITEM_H * VISIBLE_ROWS;
// Blank space above/below the list so the first and last rows can reach the centre band.
const EDGE_PAD = (WHEEL_H - ITEM_H) / 2;
const OLDEST_AGE = 120;
const DEFAULT_AGE = 35;
const pad = (n: number) => String(n).padStart(2, "0");

type Props = {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  submitLabel?: string;
};

/**
 * Date-of-birth input: same trigger as `DateField`, but opens a three-column
 * year / month / day scroll wheel instead of a month calendar — reaching a year
 * decades back is a flick, not dozens of taps. Plain ScrollViews (no native
 * picker) so it behaves the same on web/PWA and native. Dates stay "YYYY-MM-DD"
 * strings throughout — never `new Date(str)` — to avoid TZ shifting.
 */
export function BirthDateField({
  label,
  value,
  onChange,
  error,
  required,
  placeholder = "DD/MM/YYYY",
  submitLabel = "Submit",
}: Props) {
  const [open, setOpen] = useState(false);

  const now = new Date();
  const thisYear = now.getFullYear();
  const todayIso = `${thisYear}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const firstYear = thisYear - OLDEST_AGE;
  const years = Array.from({ length: OLDEST_AGE + 1 }, (_, i) => String(firstYear + i));

  const startSel = () => {
    const [y, m, d] = value ? value.split("-").map(Number) : [thisYear - DEFAULT_AGE, 1, 1];
    return {
      y: Math.max(0, Math.min(years.length - 1, y - firstYear)),
      m: m - 1,
      d: d - 1,
    };
  };
  const [sel, setSel] = useState(startSel);

  const openPicker = () => {
    setSel(startSel());
    setOpen(true);
  };

  const year = firstYear + sel.y;
  const daysInMonth = new Date(year, sel.m + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
  // Derived, not stored: moving from a 31-day month to a shorter one clamps the day.
  const dayIndex = Math.min(sel.d, daysInMonth - 1);

  const submit = () => {
    const iso = `${year}-${pad(sel.m + 1)}-${pad(dayIndex + 1)}`;
    // A birthday can't be in the future — string compare is safe for ISO dates.
    onChange(iso > todayIso ? todayIso : iso);
    setOpen(false);
  };

  return (
    <View>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      <Pressable
        onPress={openPicker}
        className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3 active:bg-gray-50"
      >
        <Text className={`text-sm ${value ? "text-gray-900" : "text-gray-400"}`}>
          {value ? formatDateDMY(value) : placeholder}
        </Text>
        <Calendar size={16} color="#9ca3af" />
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}

      <WheelModal
        visible={open}
        title={label ?? "Set birthday"}
        submitLabel={submitLabel}
        onClose={() => setOpen(false)}
        onSubmit={submit}
      >
        <Wheel items={years} index={sel.y} onIndexChange={(y) => setSel((s) => ({ ...s, y }))} />
        <Wheel items={MONTHS} index={sel.m} onIndexChange={(m) => setSel((s) => ({ ...s, m }))} />
        <Wheel items={days} index={dayIndex} onIndexChange={(d) => setSel((s) => ({ ...s, d }))} />
      </WheelModal>
    </View>
  );
}

const AGES = Array.from({ length: OLDEST_AGE + 1 }, (_, i) => String(i));

type AgeProps = {
  label?: string;
  value: string; // whole years, "" when unset
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  submitLabel?: string;
};

/** Age input: the same scroll-wheel popup as `BirthDateField`, with a single column of years. */
export function AgeField({
  label,
  value,
  onChange,
  error,
  required,
  placeholder = "Select age",
  submitLabel = "Submit",
}: AgeProps) {
  const [open, setOpen] = useState(false);

  const startIndex = () => {
    const n = value === "" ? DEFAULT_AGE : Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(OLDEST_AGE, Math.round(n))) : DEFAULT_AGE;
  };
  const [index, setIndex] = useState(startIndex);

  const openPicker = () => {
    setIndex(startIndex());
    setOpen(true);
  };

  return (
    <View>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      <Pressable
        onPress={openPicker}
        className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3 active:bg-gray-50"
      >
        <Text className={`text-sm ${value ? "text-gray-900" : "text-gray-400"}`}>{value || placeholder}</Text>
        <ChevronDown size={16} color="#9ca3af" />
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}

      <WheelModal
        visible={open}
        title={label ?? "Select age"}
        submitLabel={submitLabel}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          onChange(AGES[index]);
          setOpen(false);
        }}
      >
        <Wheel items={AGES} index={index} onIndexChange={setIndex} />
      </WheelModal>
    </View>
  );
}

/** The popup card shared by both fields: title, the wheel column(s) over a centre band, and Submit. */
function WheelModal({
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

function Wheel({
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
