"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet, Banknote, Upload, X, ShieldCheck } from "lucide-react";
import { PageHeader, SectionCard, PrimaryButton, ErrorBanner, FileUpload } from "@/components/ui";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { readDraft, clearDraft, type BookingDraft } from "@/lib/draft";
import { money } from "@/lib/format";
import { formatSlot, formatDate } from "@/lib/dates";
import {
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  PAYMENT_PROOF_BUCKET,
} from "@shared/constants";
import type { PaymentMethod } from "@shared/types";

// SCREEN_ID: PAYMENT
export default function PaymentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    const d = readDraft();
    if (!d) {
      router.replace("/appointment");
      return;
    }
    setDraft(d);
  }, [router]);

  const onFile = (f: File) => {
    setErr(null);
    if (!ALLOWED_IMAGE_MIME.includes(f.type as (typeof ALLOWED_IMAGE_MIME)[number])) {
      setErr("Please upload a PNG, JPG, or WEBP image.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setErr("File exceeds the 5 MB limit.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  };

  const confirm = async () => {
    if (!draft || !user) return;
    setErr(null);
    if (!method) {
      setErr("Choose a payment method.");
      return;
    }
    if (method === "online" && !file) {
      setErr("Upload your UPI payment screenshot to continue.");
      return;
    }
    setBusy(true);
    const sb = getSupabase();

    // Insert booking once (server-authored pricing/status via triggers).
    let bookingId = createdId;
    if (!bookingId) {
      const { data, error } = await sb
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

    if (method === "online" && file) {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${bookingId}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from(PAYMENT_PROOF_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) {
        setBusy(false);
        setErr(
          "Your booking was created but the screenshot upload failed. You can re-upload it from your dashboard."
        );
        return;
      }
      const { error: updErr } = await sb
        .from("bookings")
        .update({ payment_proof_path: path })
        .eq("id", bookingId);
      if (updErr) {
        setBusy(false);
        setErr(updErr.message);
        return;
      }
    }

    setBusy(false);
    clearDraft();
    toast.success(
      method === "direct"
        ? "Booking confirmed — pay at the visit."
        : "Booking submitted — awaiting payment verification."
    );
    router.replace("/dashboard");
  };

  if (!draft) return null;

  const total = draft.num_days * draft.price_per_day;

  return (
    <div>
      <PageHeader title="Payment" subtitle="Confirm your booking and payment method." />

      <SectionCard icon={Wallet} title="Booking summary">
        <dl className="space-y-2 text-sm">
          <Row label="Service" value={draft.service_name} />
          <Row label="Care for" value={draft.subject_name} />
          <Row label="Start date" value={formatDate(draft.start_date)} />
          <Row label="Time" value={formatSlot(draft.time_slot)} />
          <Row label="Days" value={String(draft.num_days)} />
          <Row label="Price / day" value={money(draft.price_per_day)} />
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-3">
            <dt className="text-sm font-semibold text-gray-900">Total payable</dt>
            <dd className="text-lg font-bold text-purple-700">{money(total)}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard icon={Banknote} title="Payment method">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MethodCard
            active={method === "online"}
            onClick={() => setMethod("online")}
            icon={Upload}
            title="Online UPI"
            desc="Pay now & upload a screenshot for verification."
          />
          <MethodCard
            active={method === "direct"}
            onClick={() => setMethod("direct")}
            icon={Banknote}
            title="Pay at Visit"
            desc="Settle in person when the nurse arrives."
          />
        </div>

        {method === "online" && (
          <div className="mt-4">
            {!file ? (
              <FileUpload
                onFile={onFile}
                accept=".png,.jpg,.jpeg,.webp"
                maxSizeMB={5}
                label="UPI payment screenshot"
                description="Drag & drop or click to upload your payment proof"
              />
            ) : (
              <div className="relative w-40">
                <img src={preview!} alt="Payment proof preview" className="w-40 rounded-lg border border-gray-200" />
                <button
                  onClick={clearFile}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow ring-1 ring-gray-200"
                  title="Remove"
                >
                  <X size={14} className="text-gray-600" />
                </button>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {err && <ErrorBanner message={err} />}

      <div className="mt-2 mb-3 flex items-center gap-2 text-xs text-gray-400">
        <ShieldCheck size={14} /> Your details are protected and visible only to VAgeWell staff.
      </div>

      <PrimaryButton onClick={confirm} disabled={busy || !method} fullWidth>
        {busy ? "Submitting…" : "Confirm Booking"}
      </PrimaryButton>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function MethodCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-colors ${
        active ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <Icon size={20} className={active ? "text-purple-600" : "text-gray-400"} />
      <p className="mt-2 text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
    </button>
  );
}
