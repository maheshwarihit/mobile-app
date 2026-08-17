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
  const add = useAddClinical();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setErrors({});
    const parsed = clinicalSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    const payload: Record<string, unknown> = {
      systolic: parsed.data.systolic,
      diastolic: parsed.data.diastolic,
      blood_glucose: parsed.data.blood_glucose,
      spo2: parsed.data.spo2,
      blood_group: parsed.data.blood_group || null,
      medical_conditions: parsed.data.medical_conditions || null,
      note: parsed.data.note || null,
    };
    if (subject?.profileId) payload.profile_id = subject.profileId;
    else if (subject?.familyMemberId) payload.family_member_id = subject.familyMemberId;
    add.mutate(payload, { onSuccess: onClose });
  };

  if (!subject) return null;

  return (
    <AppModal visible={open} onClose={onClose} title="Record Vitals">
      <Text className="mb-4 text-sm text-gray-500">For {subject.name}</Text>

      <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-1">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormInput
                label="Systolic (mmHg)"
                value={form.systolic}
                onChangeText={set("systolic")}
                error={errors.systolic}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <FormInput
                label="Diastolic (mmHg)"
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
                label="Glucose (mg/dL)"
                value={form.blood_glucose}
                onChangeText={set("blood_glucose")}
                error={errors.blood_glucose}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <FormInput
                label="SpO2 (%)"
                value={form.spo2}
                onChangeText={set("spo2")}
                error={errors.spo2}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <SelectSheet
            label="Blood group"
            value={form.blood_group}
            onValueChange={set("blood_group")}
            options={BLOOD_GROUP_OPTIONS}
          />
          <TextareaInput
            label="Medical conditions"
            value={form.medical_conditions}
            onChangeText={set("medical_conditions")}
            placeholder="e.g. Type 2 diabetes, hypertension"
            rows={2}
            maxLength={2000}
          />
          <TextareaInput
            label="Note"
            value={form.note}
            onChangeText={set("note")}
            placeholder="Visit note (optional)"
            rows={2}
            maxLength={1000}
          />
        </View>
      </ScrollView>

      <View className="mt-5 flex-row justify-end gap-3">
        <OutlineButton onPress={onClose}>Cancel</OutlineButton>
        <PrimaryButton loading={add.isPending} onPress={submit}>
          Save Vitals
        </PrimaryButton>
      </View>
    </AppModal>
  );
}
