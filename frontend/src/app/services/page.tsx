"use client";

import { useRouter } from "next/navigation";
import { Stethoscope, ArrowRight } from "lucide-react";
import { PageHeader, PrimaryButton, LoadingState, EmptyState, ErrorBanner } from "@/components/ui";
import { useServices } from "@/lib/hooks";
import { money } from "@/lib/format";

// SCREEN_ID: SERVICE_LIST
export default function ServicesPage() {
  const router = useRouter();
  const { data: services, isLoading, error } = useServices();

  return (
    <div>
      <PageHeader title="Care Services" subtitle="Choose a service to book a home visit." />

      {error && <ErrorBanner message="Could not load services. Please try again." />}
      {isLoading && <LoadingState message="Loading services…" />}

      {!isLoading && services?.length === 0 && (
        <EmptyState icon={Stethoscope} title="No services available" description="Please check back later." />
      )}

      <div className="space-y-3">
        {services?.map((s) => (
          <div key={s.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                  <Stethoscope size={18} className="text-purple-600" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{s.name}</h3>
                  {s.description && <p className="mt-0.5 text-sm text-gray-500">{s.description}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-gray-900">{money(s.price_per_day)}</p>
                <p className="text-[11px] text-gray-400">per day</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <PrimaryButton onClick={() => router.push(`/appointment?serviceId=${s.id}`)}>
                <span className="inline-flex items-center gap-1.5">
                  Book <ArrowRight size={14} />
                </span>
              </PrimaryButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
