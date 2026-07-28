"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RequireStaff } from "@/components/RequireStaff";
import { ImagePickerField, PrimaryButton, ErrorBanner, PageHeader, type PickedFile } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { PAYMENT_QR_BUCKET, PAYMENT_QR_OBJECT, ALLOWED_IMAGE_MIME, MAX_UPLOAD_BYTES } from "@vagewell/shared";

function PaymentQrContent() {
  const [image, setImage] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const publicUrl = supabase.storage.from(PAYMENT_QR_BUCKET).getPublicUrl(PAYMENT_QR_OBJECT).data.publicUrl;
  const previewUrl = `${publicUrl}?v=${version}`;

  const onPick = (img: PickedFile | null) => {
    setErr(null);
    if (!img) {
      setImage(null);
      return;
    }
    if (!ALLOWED_IMAGE_MIME.includes(img.file.type as (typeof ALLOWED_IMAGE_MIME)[number])) {
      setErr("Please upload a PNG, JPG, or WEBP image.");
      return;
    }
    if (img.file.size > MAX_UPLOAD_BYTES) {
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
      const bytes = await image.file.arrayBuffer();
      const { error } = await supabase.storage
        .from(PAYMENT_QR_BUCKET)
        .upload(PAYMENT_QR_OBJECT, bytes, { contentType: image.file.type, upsert: true });
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
    <div>
      <PageHeader title="Payment QR" />
      <p className="mb-4 text-sm text-gray-600">
        Upload the UPI QR code patients scan to pay. It is shown on the payment screen for online payments.
      </p>

      <div className="mb-4 flex flex-col items-center rounded-xl border border-gray-100 bg-white p-4">
        <p className="mb-2 text-xs font-semibold text-gray-500">Current QR</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={version} src={previewUrl} alt="Current payment QR" className="h-48 w-48 rounded-lg bg-gray-50 object-contain" />
        <p className="mt-2 text-[11px] text-gray-400">Shows the last uploaded QR (blank if none yet).</p>
      </div>

      {err ? <ErrorBanner message={err} /> : null}

      <ImagePickerField label="New QR image" value={image} onChange={onPick} />

      <div className="mt-4">
        <PrimaryButton fullWidth loading={busy} onClick={save}>
          Save QR
        </PrimaryButton>
      </div>
    </div>
  );
}

export default function PaymentQrPage() {
  return (
    <RequireStaff>
      <PaymentQrContent />
    </RequireStaff>
  );
}
