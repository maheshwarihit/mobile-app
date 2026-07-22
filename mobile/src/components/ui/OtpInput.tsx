import { useRef } from "react";
import { View, TextInput, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import { OTP_LENGTH } from "@vagewell/shared";

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  variant?: "light" | "dark";
  onComplete?: (value: string) => void;
};

/**
 * OTP digit-grid: one box per digit, auto-advance on entry, backspace-to-previous,
 * and paste-fills-all. `value` stays a joined string so callers pass it straight to
 * supabase.auth.verifyOtp({ token: value }).
 *
 * Boxes use FIXED pixel widths (not flex) — on react-native-web flex-1 children in a
 * row collapse when the row width isn't definite, which squished the grid.
 */
export function OtpInput({ value, onChange, length = OTP_LENGTH, autoFocus, variant = "light", onComplete }: Props) {
  const refs = useRef<(TextInput | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  const emit = (next: string) => {
    const joined = next.slice(0, length);
    onChange(joined);
    if (joined.length === length) onComplete?.(joined);
  };

  const handleChange = (text: string, i: number) => {
    const digits = text.replace(/\D/g, "");
    if (digits.length > 1) {
      // paste (or fast multi-key): distribute from index 0 for a full paste, else from i
      const start = digits.length >= length ? 0 : i;
      const arr = [...chars];
      for (let k = 0; k < digits.length && start + k < length; k++) arr[start + k] = digits[k];
      emit(arr.join(""));
      const focusIdx = Math.min(start + digits.length, length - 1);
      refs.current[focusIdx]?.focus();
      return;
    }
    const arr = [...chars];
    arr[i] = digits; // "" when cleared
    emit(arr.join(""));
    if (digits && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKey = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, i: number) => {
    if (e.nativeEvent.key === "Backspace" && !chars[i] && i > 0) {
      const arr = [...chars];
      arr[i - 1] = "";
      emit(arr.join(""));
      refs.current[i - 1]?.focus();
    }
  };

  const boxTheme =
    variant === "dark"
      ? "border-admin-border bg-admin-surface text-admin-text"
      : "border-gray-300 bg-white text-gray-900";

  return (
    <View className="flex-row justify-center" style={{ gap: 8 }}>
      {chars.map((c, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          value={c}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKey(e, i)}
          keyboardType="number-pad"
          maxLength={length}
          selectTextOnFocus
          autoFocus={autoFocus && i === 0}
          placeholderTextColor={variant === "dark" ? "#9BAAB0" : "#9ca3af"}
          style={{ width: 46, height: 56 }}
          className={`rounded-xl border text-center text-2xl font-bold ${boxTheme}`}
        />
      ))}
    </View>
  );
}
