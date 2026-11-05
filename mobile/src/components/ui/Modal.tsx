import { View, Text, Pressable, Modal } from "react-native";
import { X } from "lucide-react-native";
import { PrimaryButton, OutlineButton, DangerButton } from "./Button";

/** Base centered modal card with a backdrop and optional titled header. */
export function AppModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center px-6">
        {/* The backdrop is a sibling behind the card, not its parent: a card wrapped in a
            Pressable claims every touch, which makes a ScrollView inside it (legal documents)
            scroll slowly and stick on Android. */}
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} accessibilityLabel="Close" />
        <View className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5">
          {title ? (
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-900">{title}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={18} color="#9ca3af" />
              </Pressable>
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Confirmation dialog with Cancel + Confirm (Confirm is destructive when confirmDanger). */
export function ConfirmModal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDanger = false,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDanger?: boolean;
}) {
  return (
    <AppModal visible={open} onClose={onClose} title={title}>
      {children ? <View className="mb-6">{children}</View> : <View className="mb-6" />}
      <View className="flex-row justify-end gap-3">
        <OutlineButton onPress={onClose}>{cancelLabel}</OutlineButton>
        {confirmDanger ? (
          <DangerButton onPress={onConfirm}>{confirmLabel}</DangerButton>
        ) : (
          <PrimaryButton onPress={onConfirm}>{confirmLabel}</PrimaryButton>
        )}
      </View>
    </AppModal>
  );
}
