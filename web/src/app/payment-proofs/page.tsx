"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileImage } from "lucide-react";
import { RequireStaff } from "@/components/RequireStaff";
import { Card, Pill, LoadingState, EmptyState, PageHeader } from "@/components/ui";
import { PaymentReviewModal } from "@/components/PaymentReviewModal";
import { supabase } from "@/lib/supabase";
import {
  useAllBookings,
  money,
  formatDate,
  paymentStatusMeta,
  PAYMENT_PROOF_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type BookingWithNames,
} from "@vagewell/shared";

function PaymentProofsContent() {
  const { data: bookings, isLoading } = useAllBookings(true);
  const [selected, setSelected] = useState<BookingWithNames | null>(null);

  const withProof = useMemo(
    () => (bookings ?? []).filter((b): b is BookingWithNames & { payment_proof_path: string } => !!b.payment_proof_path),
    [bookings]
  );
  const paths = useMemo(() => withProof.map((b) => b.payment_proof_path), [withProof]);

  const { data: urls = {} } = useQuery({
    queryKey: ["payment-proof-signed-urls", paths],
    queryFn: async (): Promise<Record<string, string>> => {
      if (paths.length === 0) return {};
      const { data } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      const map: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      }
      return map;
    },
  });

  return (
    <div>
      <PageHeader title="Payment proofs" />
      <p className="mb-4 text-xs text-gray-500">
        Screenshots patients uploaded as proof of payment. Click a card to review, verify, or reject.
      </p>

      {isLoading ? <LoadingState message="Loading payment proofs…" /> : null}
      {!isLoading && withProof.length === 0 ? (
        <EmptyState icon={FileImage} title="No payment proofs" description="Uploaded screenshots appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {withProof.map((b) => {
            const meta = paymentStatusMeta(b.payment_status);
            const url = urls[b.payment_proof_path];
            return (
              <button key={b.id} onClick={() => setSelected(b)} className="text-left active:opacity-80">
                <Card className="p-4">
                  <div className="flex gap-3">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="Payment proof thumbnail" className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                        <FileImage size={18} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-base font-semibold text-gray-900">{b.account?.full_name ?? "—"}</p>
                      <p className="text-xs text-gray-500">for {b.subject_name ?? "—"}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        {b.service_name} · {money(b.total_amount)}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(b.start_date)}</p>
                      <div className="mt-1.5">
                        <Pill bgClass={meta.bg} textClass={meta.text}>
                          {meta.label}
                        </Pill>
                      </div>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <PaymentReviewModal key={selected?.id ?? "none"} booking={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export default function PaymentProofsPage() {
  return (
    <RequireStaff>
      <PaymentProofsContent />
    </RequireStaff>
  );
}
