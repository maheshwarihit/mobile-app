import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { toast } from "sonner-native";
import { Wallet, Banknote, Upload, ShieldCheck, type LucideIcon } from "lucide-react-native";
import {
  PageHeader,
  SectionCard,
  PrimaryButton,
  ErrorBanner,
  ImagePickerField,
  type PickedImage,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  PAYMENT_PROOF_BUCKET,
  money,
  formatSlot,
  formatDate,
} from "@vagewell/shared";
import type { ServicesStackScreenProps } from "@/navigation/types";

type Method = "online" | "direct" | "";

// SCREEN_ID: PAYMENT
export function PaymentScreen({ navigation, route }: ServicesStackScreenProps<"Payment">) {
  const { user } = useAuth();
  const { draft } = route.params;
  const [method, setMethod] = useState<Method>("");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const onPickImage = (img: PickedImage | null) => {
    setErr(null);
    if (!img) {
      setImage(null);
      return;
    }
    if (!ALLOWED_IMAGE_MIME.includes(img.mimeType as (typeof ALLOWED_IMAGE_MIME)[number])) {
      setErr("Please upload a PNG, JPG, or WEBP image.");
      return;
    }
    if (img.fileSize > MAX_UPLOAD_BYTES) {
      setErr("File exceeds the 5 MB limit.");
      return;
    }
    setImage(img);
  };

  const confirm = async () => {
    if (!user) return;
    setErr(null);
    if (!method) {
      setErr("Choose a payment method.");
      return;
    }
    if (method === "online" && !image) {
      setErr("Upload your UPI payment screenshot to continue.");
      return;
    }
    setBusy(true);

    // Insert the booking once (server-authored pricing/status via triggers).
    let bookingId = createdId;
    if (!bookingId) {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          service_id: draft.service_id,
          family_member_id: draft.family_member_id,
          num_days: draft.num_days,
          start_date: draft.start_date,
          time_slot: draft.time_slot,
          symptom_brief: draft.symptom_brief || null,
          payment_method: method,
        })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        setErr(error?.message ?? "Could not create the booking. Please try again.");
        return;
      }
      bookingId = data.id as string;
      setCreatedId(bookingId);
    }

    if (method === "online" && image) {
      try {
        const b64 = await FileSystem.readAsStringAsync(image.uri, { encoding: FileSystem.EncodingType.Base64 });
        const bytes = decode(b64);
        const ext = image.mimeType === "image/png" ? "png" : image.mimeType === "image/webp" ? "webp" : "jpg";
        const path = `${user.id}/${bookingId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(PAYMENT_PROOF_BUCKET)
          .upload(path, bytes, { contentType: image.mimeType, upsert: true });
        if (upErr) throw upErr;
        const { error: updErr } = await supabase.from("bookings").update({ payment_proof_path: path }).eq("id", bookingId);
        if (updErr) throw updErr;
      } catch {
        setBusy(false);
        setErr("Your booking was created but the screenshot upload failed. You can re-upload it from your dashboard.");
        return;
      }
    }

    setBusy(false);
    toast.success(
      method === "direct" ? "Booking confirmed — pay at the visit." : "Booking submitted — awaiting payment verification."
    );
    navigation.navigate("AppointmentsTab");
  };

  const total = draft.num_days * draft.price_per_day;

  return (
    <SafeAreaView className="flex-1 bg-authbg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-5 pt-4 pb-8" keyboardShouldPersistTaps="handled">
        <PageHeader title="Payment" subtitle="Confirm your booking and payment method." />

        <SectionCard icon={Wallet} title="Booking summary">
          <View className="gap-2">
            <Row label="Service" value={draft.service_name} />
            <Row label="Care for" value={draft.subject_name} />
            <Row label="Start date" value={formatDate(draft.start_date)} />
            <Row label="Time" value={formatSlot(draft.time_slot)} />
            <Row label="Days" value={String(draft.num_days)} />
            <Row label="Price / day" value={money(draft.price_per_day)} />
            <View className="mt-2 flex-row items-center justify-between border-t border-gray-100 pt-3">
              <Text className="text-sm font-semibold text-gray-900">Total payable</Text>
              <Text className="text-lg font-bold text-purple-700">{money(total)}</Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard icon={Banknote} title="Payment method">
          <View className="gap-3">
            <MethodCard
              active={method === "online"}
              onPress={() => setMethod("online")}
              icon={Upload}
              title="Online UPI"
              desc="Pay now & upload a screenshot for verification."
            />
            <MethodCard
              active={method === "direct"}
              onPress={() => setMethod("direct")}
              icon={Banknote}
              title="Pay at Visit"
              desc="Settle in person when the nurse arrives."
            />
          </View>

          {method === "online" ? (
            <View className="mt-4">
              <ImagePickerField label="UPI payment screenshot" value={image} onChange={onPickImage} onError={setErr} />
            </View>
          ) : null}
        </SectionCard>

        {err ? <ErrorBanner message={err} /> : null}

        <View className="mb-3 mt-2 flex-row items-center gap-2">
          <ShieldCheck size={14} color="#9ca3af" />
          <Text className="flex-1 text-xs text-gray-400">
            Your details are protected and visible only to VAgeWell staff.
          </Text>
        </View>

        <PrimaryButton fullWidth loading={busy} disabled={!method} onPress={confirm}>
          Confirm Booking
        </PrimaryButton>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm font-medium text-gray-900">{value}</Text>
    </View>
  );
}

function MethodCard({
  active,
  onPress,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onPress: () => void;
  icon: LucideIcon;
  title: string;
  desc: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl border p-4 ${active ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white"}`}
    >
      <Icon size={20} color={active ? "#9333ea" : "#9ca3af"} />
      <Text className="mt-2 text-sm font-semibold text-gray-900">{title}</Text>
      <Text className="mt-0.5 text-xs text-gray-500">{desc}</Text>
    </Pressable>
  );
}
