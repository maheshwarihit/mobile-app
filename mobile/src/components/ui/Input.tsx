import { useState } from "react";
import { View, Text, TextInput, Pressable, type KeyboardTypeOptions } from "react-native";
import { Eye, EyeOff, type LucideIcon } from "lucide-react-native";

type FieldWrap = { label?: string; error?: string; required?: boolean; children: React.ReactNode };

function Field({ label, error, required, children }: FieldWrap) {
  return (
    <View>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      {children}
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}

type FormInputProps = {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  editable?: boolean;
  icon?: LucideIcon;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
};

/** Standard text/number/phone input with label and optional leading icon */
export function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  required,
  editable = true,
  icon: Icon,
  keyboardType,
  autoCapitalize,
  maxLength,
}: FormInputProps) {
  const [focused, setFocused] = useState(false);
  const border = !editable
    ? "border-gray-200 bg-gray-50"
    : focused
      ? "border-purple-500 bg-white"
      : "border-gray-300 bg-white";
  return (
    <Field label={label} error={error} required={required}>
      <View className={`flex-row items-center rounded-lg border ${border} px-3`}>
        {Icon ? <Icon size={16} color="#9ca3af" /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`flex-1 py-3 text-sm ${Icon ? "pl-2" : ""} ${editable ? "text-gray-900" : "text-gray-700"}`}
        />
      </View>
    </Field>
  );
}

/** Password input with show/hide toggle */
export function PasswordInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
}: Omit<FormInputProps, "icon" | "keyboardType">) {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const border = focused ? "border-purple-500" : "border-gray-300";
  return (
    <Field label={label} error={error}>
      <View className={`flex-row items-center rounded-lg border ${border} bg-white px-3`}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          secureTextEntry={!show}
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 py-3 text-sm text-gray-900"
        />
        <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
          {show ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
        </Pressable>
      </View>
    </Field>
  );
}

type TextareaProps = FormInputProps & { rows?: number };

/** Multiline input with optional char counter */
export function TextareaInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  required,
  maxLength,
  rows = 5,
}: TextareaProps) {
  const [focused, setFocused] = useState(false);
  const border = focused ? "border-purple-500" : "border-gray-300";
  return (
    <Field label={label} error={error} required={required}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline
        textAlignVertical="top"
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ minHeight: rows * 22 }}
        className={`rounded-lg border ${border} bg-white px-3 py-3 text-sm text-gray-900`}
      />
      {maxLength ? (
        <Text className="mt-1 self-end text-xs text-gray-400">
          {value?.length ?? 0}/{maxLength}
        </Text>
      ) : null}
    </Field>
  );
}
