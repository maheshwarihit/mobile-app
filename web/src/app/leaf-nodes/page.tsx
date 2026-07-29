"use client";

import { RequireStaff } from "@/components/RequireStaff";
import { OpsMemberList } from "@/components/OpsMemberList";

export default function LeafNodesPage() {
  return (
    <RequireStaff>
      <OpsMemberList role="leaf_node" title="Leaf Nodes" emptyLabel="leaf node members" />
    </RequireStaff>
  );
}
