"use client";

import { use } from "react";
import { RequireStaff } from "@/components/RequireStaff";
import { MemberEditForm } from "@/components/MemberEditForm";
import { useAllProfiles } from "@vagewell/shared";

function SelfEditContent({ accountId }: { accountId: string }) {
  const { data: profiles } = useAllProfiles(true);
  const name = (profiles ?? []).find((p) => p.id === accountId)?.full_name ?? "Client";
  return <MemberEditForm subject={{ kind: "self", profileId: accountId }} name={name} backHref={`/patients/${accountId}`} />;
}

export default function SelfEditPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = use(params);
  return (
    <RequireStaff>
      <SelfEditContent accountId={accountId} />
    </RequireStaff>
  );
}
