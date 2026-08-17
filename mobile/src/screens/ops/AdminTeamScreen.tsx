import { useMemo, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClipboardList } from "lucide-react-native";
import {
  useAllProfiles,
  useSetUserRole,
  localPhone,
  formatDate,
  ROLES,
  ROLE_LABELS,
  type Role,
  type Profile,
} from "@vagewell/shared";
import { PageHeader, Card, FormInput, SelectSheet, LoadingState, EmptyState } from "@/components/ui";
import { ProfilePhoto } from "@/components/ops/ProfilePhoto";

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

/**
 * SCREEN_ID: ADMIN_TEAM — caregiver (leaf_node) roster plus the promote path.
 * Port of web/src/components/OpsMemberList.tsx as used by /leaf-nodes.
 *
 * With no search query this lists only current caregivers, so it doesn't just
 * become "everyone". Typing widens the pool to every account so an existing
 * client can be found and promoted right here — results are then split into
 * "Team" and "Clients" so a client doesn't read as if they already have ops
 * access. `set_user_role()` is admin-only server-side; this screen is only in
 * the admin top nav to match.
 */
type Section = { title: string; data: Profile[] };

export function AdminTeamScreen() {
  const { data: profiles, isLoading } = useAllProfiles(true);
  const setRole = useSetUserRole();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const sections = useMemo<Section[]>(() => {
    const pool = q ? profiles ?? [] : (profiles ?? []).filter((p) => p.role === "leaf_node");
    const matched = pool
      .filter((p) => !q || (p.full_name ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

    if (!q) return [{ title: "", data: matched }];

    const ops = matched.filter((p) => p.role !== "patient");
    const clients = matched.filter((p) => p.role === "patient");
    const out: Section[] = [];
    if (ops.length) out.push({ title: "Team", data: ops });
    if (clients.length) out.push({ title: "Clients (not yet on the team)", data: clients });
    return out;
  }, [profiles, q]);

  // Flattened to a single list so one FlatList renders both sections.
  type Row = { kind: "header"; title: string } | { kind: "member"; profile: Profile };
  const flat: Row[] = sections.flatMap((s) => [
    ...(s.title ? [{ kind: "header" as const, title: s.title }] : []),
    ...s.data.map((p) => ({ kind: "member" as const, profile: p })),
  ]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={[]}>
      <FlatList
        data={flat}
        keyExtractor={(r, i) => (r.kind === "header" ? `h:${r.title}` : `m:${r.profile.id}`) + i}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View>
            <PageHeader title="Care team" subtitle="Caregivers who can be assigned home visits." />
            <View className="mb-4">
              <FormInput
                label="Search by name or phone"
                value={query}
                onChangeText={setQuery}
                placeholder="Search anyone to promote them…"
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message="Loading…" />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title={q ? "No match" : "No caregivers yet"}
              description={
                q
                  ? "No account matches that name or phone."
                  : "Search above by name or phone to find a registered account and make them a caregiver."
              }
            />
          )
        }
        renderItem={({ item }) =>
          item.kind === "header" ? (
            <Text className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{item.title}</Text>
          ) : (
            <MemberRow
              profile={item.profile}
              onSetRole={(r) => setRole.mutate({ userId: item.profile.id, role: r })}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function MemberRow({ profile: p, onSetRole }: { profile: Profile; onSetRole: (role: Role) => void }) {
  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <ProfilePhoto profile={p} size={40} />
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">{p.full_name ?? "—"}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {localPhone(p.phone) || "—"} · Joined {formatDate(p.created_at)}
          </Text>
        </View>
      </View>
      <View className="mt-3">
        <SelectSheet label="Role" value={p.role} onValueChange={(r) => onSetRole(r as Role)} options={ROLE_OPTIONS} />
      </View>
    </Card>
  );
}
