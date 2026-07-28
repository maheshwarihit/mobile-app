"use client";

import { use } from "react";
import { RequireStaff } from "@/components/RequireStaff";
import { MemberEditForm } from "@/components/MemberEditForm";
import { useFamilyMembersByAccount } from "@vagewell/shared";

function DependentEditContent({ accountId, familyMemberId }: { accountId: string; familyMemberId: string }) {
  const { data: dependents } = useFamilyMembersByAccount(accountId);
  const name = (dependents ?? []).find((d) => d.id === familyMemberId)?.full_name ?? "Dependent";
  return (
    <MemberEditForm
      subject={{ kind: "dependent", familyMemberId, accountId }}
      name={name}
      backHref={`/patients/${accountId}`}
    />
  );
}

export default function DependentEditPage({ params }: { params: Promise<{ accountId: string; familyMemberId: string }> }) {
  const { accountId, familyMemberId } = use(params);
  return (
    <RequireStaff>
      <DependentEditContent accountId={accountId} familyMemberId={familyMemberId} />
    </RequireStaff>
  );
}
