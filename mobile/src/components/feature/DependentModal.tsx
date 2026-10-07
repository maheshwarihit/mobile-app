import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import { FormInput, SelectSheet, PrimaryButton, OutlineButton, AgeField, BirthDateField } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";
import { genderLabel, relationshipLabel } from "@/lib/enumI18n";
import { translateTamilToEnglish } from "@/lib/translateText";
import {
  useSaveDependent,
  dependentSchema,
  normalizePhone,
  ageFromDob,
  RELATIONSHIPS,
  GENDERS,
  type FamilyMember,
} from "@vagewell/shared";

const EMPTY = { full_name: "", age: "", date_of_birth: "", relationship: RELATIONSHIPS[0] as string, contact_phone: "", gender: "" };

export function DependentModal({
  open,
  dependent,
  accountId,
  onClose,
}: {
  open: boolean;
  dependent: FamilyMember | null;
  accountId: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const RELATIONSHIP_OPTIONS = RELATIONSHIPS.map((r) => ({ value: r, label: relationshipLabel(t, r) }));
  const GENDER_OPTIONS = GENDERS.map((g) => ({ value: g, label: genderLabel(t, g) }));
  const { height } = useWindowDimensions();
  const save = useSaveDependent();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setErrors({});
      setForm(
        dependent
          ? {
              full_name: dependent.full_name,
              age: dependent.age?.toString() ?? "",
              date_of_birth: dependent.date_of_birth ?? "",
              relationship: dependent.relationship,
              contact_phone: dependent.contact_phone ?? "",
              gender: dependent.gender ?? "",
            }
          : EMPTY
      );
    }
  }, [open, dependent]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  // Picking a date of birth fills in the matching age (and clears any old
  // age error), so the two can't disagree unless the age is changed after.
  const setDob = (v: string) => {
    const age = ageFromDob(v);
    setForm((f) => ({ ...f, date_of_birth: v, age: age === null ? f.age : String(age) }));
    setErrors(({ age: _age, date_of_birth: _dob, ...rest }) => rest);
  };

  const submit = async () => {
    setErrors({});
    const parsed = dependentSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    const full_name = await translateTamilToEnglish(parsed.data.full_name);
    setSubmitting(false);
    save.mutate(
      {
        id: dependent?.id,
        account_id: accountId,
        full_name,
        age: parsed.data.age,
        date_of_birth: parsed.data.date_of_birth,
        relationship: parsed.data.relationship,
        contact_phone: form.contact_phone ? normalizePhone(form.contact_phone) : null,
        gender: parsed.data.gender,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onClose}>
          <Pressable
            style={{ maxHeight: height * 0.85 }}
            className="w-full max-w-md rounded-2xl border border-gray-100 bg-white"
            onPress={() => {}}
          >
            <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-lg font-bold text-gray-900">{dependent ? t("modal.dependent.editTitle") : t("modal.dependent.addTitle")}</Text>
                <Pressable onPress={onClose} hitSlop={8}>
                  <X size={18} color="#9ca3af" />
                </Pressable>
              </View>

              <View className="gap-4">
                <FormInput label={t("modal.dependent.fullName")} value={form.full_name} onChangeText={set("full_name")} error={errors.full_name} autoCapitalize="words" required />
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <AgeField label={t("modal.dependent.age")} value={form.age} onChange={set("age")} error={errors.age} required />
                  </View>
                  <View className="flex-1">
                    <SelectSheet label={t("modal.dependent.relationship")} value={form.relationship} onValueChange={set("relationship")} options={RELATIONSHIP_OPTIONS} />
                  </View>
                </View>
                <BirthDateField label={t("modal.dependent.dob")} value={form.date_of_birth} onChange={setDob} error={errors.date_of_birth} required />
                <SelectSheet
                  label={t("modal.dependent.gender")}
                  value={form.gender}
                  onValueChange={set("gender")}
                  options={GENDER_OPTIONS}
                  placeholder={t("modal.dependent.genderPlaceholder")}
                  error={errors.gender}
                  required
                />
                <FormInput label={t("modal.dependent.contactNumber")} value={form.contact_phone} onChangeText={set("contact_phone")} keyboardType="phone-pad" error={errors.contact_phone} required />
              </View>

              <View className="mt-6 flex-row justify-end gap-2">
                <OutlineButton onPress={onClose}>{t("modal.dependent.cancel")}</OutlineButton>
                <PrimaryButton loading={submitting || save.isPending} onPress={submit}>
                  {t("modal.dependent.save")}
                </PrimaryButton>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
