import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useAddClinical, clinicalSchema, BLOOD_GROUPS } from "@vagewell/shared";
import {
  AppModal,
  FormInput,
  SelectSheet,
  TextareaInput,
  PrimaryButton,
  OutlineButton,
} from "@/components/ui";
import { useLanguage } from "@/lib/i18n";
import { translateTamilToEnglish } from "@/lib/translateText";

export interface VitalsSubject {
  profileId?: string;
  familyMemberId?: string;
  name: string;
}

const BLOOD_GROUP_OPTIONS = [{ value: "", label: "—" }, ...BLOOD_GROUPS.map((b) => ({ value: b, label: b }))];
const EMPTY = {
  systolic: "",
  diastolic: "",
  blood_glucose: "",
  spo2: "",
  blood_group: "",
  medical_conditions: "",
  note: "",
};

/**
 * Caregiver/admin records a visit's vitals. Mirrors web/src/components/VitalsModal.tsx.
 *
 * The caller must key this component on the subject's identity so React mounts
 * a fresh instance — with fresh useState defaults — per subject, instead of
 * reusing one instance and resetting form state via an effect.
 */
export function VitalsModal({
  open,
  subject,
  onClose,
}: {
  open: boolean;
  subject: VitalsSubject | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const add = useAddClinical();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setErrors({});
    const parsed = clinicalSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    const [medicalConditions, note] = await Promise.all([
      parsed.data.medical_conditions ? translateTamilToEnglish(parsed.data.medical_conditions) : Promise.resolve(null),
      parsed.data.note ? translateTamilToEnglish(parsed.data.note) : Promise.resolve(null),
    ]);
    setSubmitting(false);
    const payload: Record<string, unknown> = {
      systolic: parsed.data.systolic,
      diastolic: parsed.data.diastolic,
      blood_glucose: parsed.data.blood_glucose,
      spo2: parsed.data.spo2,
      blood_group: parsed.data.blood_group || null,
      medical_conditions: medicalConditions,
      note: note,
    };
    if (subject?.profileId) payload.profile_id = subject.profileId;
    else if (subject?.familyMemberId) payload.family_member_id = subject.familyMemberId;
    add.mutate(payload, { onSuccess: onClose });
  };

  if (!subject) return null;

  return (
    <AppModal visible={open} onClose={onClose} title={t("modal.vitals.title")}>
      <Text className="mb-4 text-sm text-gray-500">{t("modal.vitals.for", { name: subject.name })}</Text>

      <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-1">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormInput
                label={t("modal.vitals.systolic")}
                value={form.systolic}
                onChangeText={set("systolic")}
                error={errors.systolic}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <FormInput
                label={t("modal.vitals.diastolic")}
                value={form.diastolic}
                onChangeText={set("diastolic")}
                error={errors.diastolic}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormInput
                label={t("modal.vitals.glucose")}
                value={form.blood_glucose}
                onChangeText={set("blood_glucose")}
                error={errors.blood_glucose}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <FormInput
                label={t("modal.vitals.spo2")}
                value={form.spo2}
                onChangeText={set("spo2")}
                error={errors.spo2}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <SelectSheet
            label={t("modal.vitals.bloodGroup")}
            value={form.blood_group}
            onValueChange={set("blood_group")}
            options={BLOOD_GROUP_OPTIONS}
          />
          <TextareaInput
            label={t("modal.vitals.medicalConditions")}
            value={form.medical_conditions}
            onChangeText={set("medical_conditions")}
            placeholder={t("modal.vitals.medicalConditionsPlaceholder")}
            rows={2}
            maxLength={2000}
          />
          <TextareaInput
            label={t("modal.vitals.note")}
            value={form.note}
            onChangeText={set("note")}
            placeholder={t("modal.vitals.notePlaceholder")}
            rows={2}
            maxLength={1000}
          />
        </View>
      </ScrollView>

      <View className="mt-5 flex-row justify-end gap-3">
        <OutlineButton onPress={onClose}>{t("modal.vitals.cancel")}</OutlineButton>
        <PrimaryButton loading={submitting || add.isPending} onPress={submit}>
          {t("modal.vitals.save")}
        </PrimaryButton>
      </View>
    </AppModal>
  );
}
