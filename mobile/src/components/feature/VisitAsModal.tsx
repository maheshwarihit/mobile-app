import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { HeartHandshake, Stethoscope } from "lucide-react-native";
import { GradientButton } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";

export type VisitAs = "care_seeker" | "caregiver";

/**
 * "Visit as" picker — opened from Landing's Get Started button. Two options:
 * Care Seeker (client) and Caregiver / Admin. Deliberately its own dark-card
 * modal rather than the shared white `AppModal` used everywhere else in the
 * app — this restyle is scoped to the Landing/Onboarding hero screens, not a
 * re-theme of every modal in the app.
 *
 * Picking an option here only decides which *form* opens next (`onContinue`
 * — Landing maps "care_seeker" to the client AuthModal and "caregiver" to the
 * staff/admin one). Both doors support Login and Sign up; the staff/admin
 * AuthModal instance also carries a role picker (Admin/Care Giver) on its
 * Sign up step (`rolePicker`, see AuthModal) — picking this option and
 * signing up grants that role immediately, no approval step.
 */
export function VisitAsModal({
  visible,
  onClose,
  onContinue,
}: {
  visible: boolean;
  onClose: () => void;
  onContinue: (choice: VisitAs) => void;
}) {
  const { t } = useLanguage();
  const [choice, setChoice] = useState<VisitAs>("care_seeker");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={onClose}>
        <Pressable
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F2A30] p-5"
          onPress={() => {}}
        >
          <Text className="mb-4 text-lg font-bold text-white">{t("landing.visitAs.title")}</Text>

          <View className="gap-3">
            <VisitAsOption
              icon={HeartHandshake}
              label={t("landing.visitAs.careSeeker")}
              selected={choice === "care_seeker"}
              onPress={() => setChoice("care_seeker")}
            />
            <VisitAsOption
              icon={Stethoscope}
              label={t("landing.visitAs.caregiver")}
              selected={choice === "caregiver"}
              onPress={() => setChoice("caregiver")}
            />
          </View>

          <View className="mt-5">
            <GradientButton fullWidth onPress={() => onContinue(choice)}>
              {t("landing.visitAs.continue")}
            </GradientButton>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function VisitAsOption({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-xl border px-4 py-3.5 ${
        selected ? "border-teal-400 bg-teal-400/10" : "border-white/15 bg-white/5"
      }`}
    >
      <Icon size={18} color={selected ? "#5EEAD4" : "#9CA3AF"} />
      <Text className={`flex-1 text-sm font-semibold ${selected ? "text-teal-200" : "text-gray-300"}`}>{label}</Text>
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? "border-teal-400" : "border-gray-500"
        }`}
      >
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-teal-400" /> : null}
      </View>
    </Pressable>
  );
}
