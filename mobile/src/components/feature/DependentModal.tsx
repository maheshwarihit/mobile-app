import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import { FormInput, SelectSheet, PrimaryButton, OutlineButton } from "@/components/ui";
import {
  useSaveDependent,
  dependentSchema,
  normalizePhone,
  RELATIONSHIPS,
  GENDERS,
  GENDER_LABELS,
  type FamilyMember,
} from "@vagewell/shared";

const RELATIONSHIP_OPTIONS = RELATIONSHIPS.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }));
const GENDER_OPTIONS = [{ value: "", label: "—" }, ...GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))];
const EMPTY = { full_name: "", age: "", relationship: RELATIONSHIPS[0] as string, contact_phone: "", gender: "" };

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
  const { height } = useWindowDimensions();
  const save = useSaveDependent();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
      setForm(
        dependent
          ? {
              full_name: dependent.full_name,
              age: dependent.age?.toString() ?? "",
              relationship: dependent.relationship,
              contact_phone: dependent.contact_phone ?? "",
              gender: dependent.gender ?? "",
            }
          : EMPTY
      );
    }
  }, [open, dependent]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setErrors({});
    const parsed = dependentSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    save.mutate(
      {
        id: dependent?.id,
        account_id: accountId,
        full_name: parsed.data.full_name,
        age: parsed.data.age,
        relationship: parsed.data.relationship,
        contact_phone: form.contact_phone ? normalizePhone(form.contact_phone) : null,
        gender: form.gender || null,
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
                <Text className="text-lg font-bold text-gray-900">{dependent ? "Edit dependent" : "Add dependent"}</Text>
                <Pressable onPress={onClose} hitSlop={8}>
                  <X size={18} color="#9ca3af" />
                </Pressable>
              </View>

              <View className="gap-4">
                <FormInput label="Full name" value={form.full_name} onChangeText={set("full_name")} error={errors.full_name} autoCapitalize="words" required />
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <FormInput label="Age" value={form.age} onChangeText={set("age")} keyboardType="number-pad" error={errors.age} />
                  </View>
                  <View className="flex-1">
                    <SelectSheet label="Relationship" value={form.relationship} onValueChange={set("relationship")} options={RELATIONSHIP_OPTIONS} />
                  </View>
                </View>
                <SelectSheet label="Gender (optional)" value={form.gender} onValueChange={set("gender")} options={GENDER_OPTIONS} />
                <FormInput label="Contact number (optional)" value={form.contact_phone} onChangeText={set("contact_phone")} keyboardType="phone-pad" error={errors.contact_phone} />
              </View>

              <View className="mt-6 flex-row justify-end gap-2">
                <OutlineButton onPress={onClose}>Cancel</OutlineButton>
                <PrimaryButton loading={save.isPending} onPress={submit}>
                  Save
                </PrimaryButton>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
