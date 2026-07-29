"use client";

import { RequireStaff } from "@/components/RequireStaff";
import { OpsMemberList } from "@/components/OpsMemberList";

export default function StaffPage() {
  return (
    <RequireStaff>
      <OpsMemberList role="staff" title="Staff" emptyLabel="staff members" />
    </RequireStaff>
  );
}
