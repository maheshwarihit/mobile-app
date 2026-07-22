import { useState } from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { toast } from "sonner-native";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { ImagePickerField, PrimaryButton, ErrorBanner, type PickedImage } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { imageUriToBytes } from "@/lib/fileBytes";
import {
  PAYMENT_QR_BUCKET,
  PAYMENT_QR_OBJECT,
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
} from "@vagewell/shared";
import type { AdminScreenProps } from "@/navigation/types";

// Admin-only: upload/replace the single UPI QR shown to patients on the payment screen.
export function AdminPaymentQrScreen({ navigation }: AdminScreenProps<"AdminPaymentQr">) {
  const [image, setImage] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // bust the preview cache after an upload

  const publicUrl = supabase.storage.from(PAYMENT_QR_BUCKET).getPublicUrl(PAYMENT_QR_OBJECT).data.publicUrl;
  const previewUrl = `${publicUrl}?v=${version}`;

  const onPick = (img: PickedImage | null) => {
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

  const save = async () => {
    if (!image) {
      setErr("Choose a QR image first.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const bytes = await imageUriToBytes(image.uri);
      const { error } = await supabase.storage
        .from(PAYMENT_QR_BUCKET)
        .upload(PAYMENT_QR_OBJECT, bytes, { contentType: image.mimeType, upsert: true });
      if (error) throw error;
      setVersion((v) => v + 1);
      setImage(null);
      toast.success("Payment QR updated");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed. Please try again.");
    }
    setBusy(false);
  };

  return (
    <AdminScreen title="Payment QR" onBack={() => navigation.goBack()}>
      <ScrollView contentContainerClassName="px-5 pt-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="mb-4 text-sm text-gray-600">
          Upload the UPI QR code patients scan to pay. It is shown on the payment screen for online payments.
        </Text>

        <View className="mb-4 items-center rounded-xl border border-gray-100 bg-white p-4">
          <Text className="mb-2 text-xs font-semibold text-gray-500">Current QR</Text>
          <Image
            key={version}
            source={{ uri: previewUrl }}
            className="h-48 w-48 rounded-lg bg-gray-50"
            resizeMode="contain"
          />
          <Text className="mt-2 text-[11px] text-gray-400">Shows the last uploaded QR (blank if none yet).</Text>
        </View>

        {err ? (
          <View className="mb-3">
            <ErrorBanner message={err} />
          </View>
        ) : null}

        <ImagePickerField label="New QR image" value={image} onChange={onPick} onError={setErr} />

        <View className="mt-4">
          <PrimaryButton fullWidth loading={busy} onPress={save}>
            Save QR
          </PrimaryButton>
        </View>
      </ScrollView>
    </AdminScreen>
  );
}
