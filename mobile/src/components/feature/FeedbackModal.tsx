import { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Star } from "lucide-react-native";
import { AppModal, PrimaryButton } from "@/components/ui";
import { useSendFeedback } from "@/lib/feedback";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { WARN } from "@/theme";

const RATING_KEYS: TranslationKey[] = [
  "feedback.rating.1",
  "feedback.rating.2",
  "feedback.rating.3",
  "feedback.rating.4",
  "feedback.rating.5",
];

/**
 * "Send feedback" — the patient's star rating (1–5, required) and an optional
 * message, saved to the feedback table for the admin (admin → Feedback).
 */
export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const send = useSendFeedback();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  // Shown inside the popup: a toast would sit behind it.
  const [failed, setFailed] = useState(false);

  const close = () => {
    setRating(0);
    setMessage("");
    setFailed(false);
    onClose();
  };

  const submit = () => {
    if (!rating) return;
    setFailed(false);
    send.mutate(
      { rating, message },
      {
        onSuccess: () => {
          toast.success(t("feedback.thanks"));
          close();
        },
        onError: () => setFailed(true),
      },
    );
  };

  return (
    <AppModal visible={open} onClose={close} title={t("feedback.title")}>
      <Text className="text-sm text-gray-600">{t("feedback.question")}</Text>
      <View className="my-4 flex-row justify-center gap-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setRating(n)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t(RATING_KEYS[n - 1])}
            accessibilityState={{ selected: rating === n }}
            className="active:opacity-70"
          >
            <Star size={34} color={n <= rating ? WARN : "#d1d5db"} fill={n <= rating ? WARN : "transparent"} />
          </Pressable>
        ))}
      </View>
      <Text className="mb-4 text-center text-sm font-semibold text-gray-700">
        {rating ? t(RATING_KEYS[rating - 1]) : t("feedback.tapStar")}
      </Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder={t("feedback.placeholder")}
        placeholderTextColor="#9ca3af"
        multiline
        maxLength={2000}
        textAlignVertical="top"
        className="mb-4 min-h-[96px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900"
      />
      {failed ? <Text className="mb-3 text-center text-sm font-semibold text-red-600">{t("feedback.failed")}</Text> : null}
      <PrimaryButton fullWidth disabled={!rating || send.isPending} onPress={submit}>
        {send.isPending ? t("feedback.sending") : t("feedback.send")}
      </PrimaryButton>
    </AppModal>
  );
}
