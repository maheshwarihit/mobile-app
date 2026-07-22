import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from "react-native";
import { X, Activity } from "lucide-react-native";
import { FormInput, SelectSheet, TextareaInput, PrimaryButton, OutlineButton } from "@/components/ui";
import { BRAND } from "@/theme";
import { useAddClinical, clinicalSchema, BLOOD_GROUPS } from "@vagewell/shared";

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

export function VitalsModal({
  open,
  subject,
  onClose,
}: {
  open: boolean;
  subject: VitalsSubject | null;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const add = useAddClinical();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrors({});
    }
  }, [open, subject]);

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

  return (
    <Modal visible={open && !!subject} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onClose}>
          <Pressable
            style={{ maxHeight: height * 0.85 }}
            className="w-full max-w-md rounded-2xl border border-gray-100 bg-white"
            onPress={() => {}}
          >
            {subject ? (
              <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Activity size={18} color={BRAND} />
                    <Text className="text-lg font-bold text-gray-900">Record Vitals</Text>
                  </View>
                  <Pressable onPress={onClose} hitSlop={8}>
                    <X size={18} color="#9ca3af" />
                  </Pressable>
                </View>
                <Text className="mb-4 mt-1 text-sm text-gray-500">For {subject.name}</Text>

                <View className="gap-4">
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <FormInput label="Systolic (mmHg)" value={form.systolic} onChangeText={set("systolic")} keyboardType="number-pad" error={errors.systolic} />
                    </View>
                    <View className="flex-1">
                      <FormInput label="Diastolic (mmHg)" value={form.diastolic} onChangeText={set("diastolic")} keyboardType="number-pad" error={errors.diastolic} />
                    </View>
                  </View>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <FormInput label="Glucose (mg/dL)" value={form.blood_glucose} onChangeText={set("blood_glucose")} keyboardType="number-pad" error={errors.blood_glucose} />
                    </View>
                    <View className="flex-1">
                      <FormInput label="SpO2 (%)" value={form.spo2} onChangeText={set("spo2")} keyboardType="number-pad" error={errors.spo2} />
                    </View>
                  </View>
                  <SelectSheet label="Blood group" value={form.blood_group} onValueChange={set("blood_group")} options={BLOOD_GROUP_OPTIONS} />
                  <TextareaInput label="Medical conditions" value={form.medical_conditions} onChangeText={set("medical_conditions")} placeholder="e.g. Type 2 diabetes, hypertension" rows={2} maxLength={2000} />
                  <TextareaInput label="Note" value={form.note} onChangeText={set("note")} placeholder="Visit note (optional)" rows={2} maxLength={1000} />
                </View>

                <View className="mt-6 flex-row justify-end gap-2">
                  <OutlineButton onPress={onClose}>Cancel</OutlineButton>
                  <PrimaryButton loading={add.isPending} onPress={submit}>
                    Save Vitals
                  </PrimaryButton>
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
