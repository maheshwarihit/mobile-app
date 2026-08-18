import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClipboardList, ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react-native";
import {
  useAllProfiles,
  useAllBookings,
  useSetUserRole,
  localPhone,
  formatDate,
  money,
  bookingStatusMeta,
  ROLES,
  ROLE_LABELS,
  type Role,
  type Profile,
} from "@vagewell/shared";
import { PageHeader, Card, Pill, FormInput, SelectSheet, LoadingState, EmptyState } from "@/components/ui";
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

export function AdminTeamScreen({ onOpenClient }: { onOpenClient?: (accountId: string) => void }) {
  const { data: profiles, isLoading } = useAllProfiles(true);
  const setRole = useSetUserRole();
  const [query, setQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);

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

  if (selectedMember) {
    return (
      <TeamMemberDetail member={selectedMember} onBack={() => setSelectedMember(null)} onOpenClient={onOpenClient} />
    );
  }

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
            <PageHeader title="Care team" subtitle="Care Assistants who can be assigned home visits." />
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
              title={q ? "No match" : "No Care Assistants yet"}
              description={
                q
                  ? "No account matches that name or phone."
                  : "Search above by name or phone to find a registered account and make them a Care Assistant."
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
              onPress={item.profile.role === "leaf_node" ? () => setSelectedMember(item.profile) : undefined}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function MemberRow({
  profile: p,
  onSetRole,
  onPress,
}: {
  profile: Profile;
  onSetRole: (role: Role) => void;
  onPress?: () => void;
}) {
  return (
    <Card className="p-4">
      <Pressable onPress={onPress} disabled={!onPress} hitSlop={4} className="flex-row items-center gap-3 active:opacity-70">
        <ProfilePhoto profile={p} size={40} />
        <View className="flex-1">
          <Text className={`text-base font-semibold text-gray-900 dark:text-white ${onPress ? "underline" : ""}`}>
            {p.full_name ?? "—"}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {localPhone(p.phone) || "—"} · Joined {formatDate(p.created_at)}
          </Text>
        </View>
        {onPress ? <ChevronRight size={18} color="#9ca3af" /> : null}
      </Pressable>
      <View className="mt-3">
        <SelectSheet label="Role" value={p.role} onValueChange={(r) => onSetRole(r as Role)} options={ROLE_OPTIONS} />
      </View>
    </Card>
  );
}

/**
 * A Care Assistant's own clients & visit history — every booking ever
 * assigned to them, filtered client-side from `useAllBookings` (bk_select
 * already grants an admin every booking, so no dedicated query needed).
 * Mirrors the deleted web portal's `/team/[memberId]` page.
 */
function TeamMemberDetail({
  member,
  onBack,
  onOpenClient,
}: {
  member: Profile;
  onBack: () => void;
  onOpenClient?: (accountId: string) => void;
}) {
  const { data: bookings, isLoading } = useAllBookings(true);
  const assigned = useMemo(
    () =>
      (bookings ?? [])
        .filter((b) => b.assigned_to === member.id)
        .sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [bookings, member.id]
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={[]}>
      <FlatList
        data={assigned}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View>
            <Pressable onPress={onBack} hitSlop={8} className="mb-4 flex-row items-center gap-1 active:opacity-70">
              <ChevronLeft size={18} color="#6b7280" />
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">Care team</Text>
            </Pressable>
            <Card className="mb-4 p-4">
              <View className="flex-row items-center gap-3">
                <ProfilePhoto profile={member} size={48} />
                <View className="flex-1">
                  <Text className="text-lg font-bold text-gray-900 dark:text-white">{member.full_name ?? "—"}</Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    {ROLE_LABELS[member.role]} · {localPhone(member.phone) || "—"} · Joined {formatDate(member.created_at)}
                  </Text>
                </View>
              </View>
            </Card>
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Clients & visit history
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message="Loading…" />
          ) : (
            <EmptyState
              icon={CalendarCheck}
              title="No visits yet"
              description="Bookings assigned to this Care Assistant will appear here."
            />
          )
        }
        renderItem={({ item: b }) => {
          const status = bookingStatusMeta(b.booking_status);
          return (
            <Card className="p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white">{b.service_name}</Text>
                  <Pressable
                    onPress={onOpenClient ? () => onOpenClient(b.account_id) : undefined}
                    disabled={!onOpenClient}
                    hitSlop={4}
                    className="mt-0.5 self-start active:opacity-70"
                  >
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      Client{" "}
                      <Text className={`font-medium text-purple-600 dark:text-purple-300 ${onOpenClient ? "underline" : ""}`}>
                        {b.subject_name ?? "—"}
                      </Text>
                    </Text>
                  </Pressable>
                  <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDate(b.start_date)}</Text>
                </View>
                <View className="items-end gap-1.5">
                  <Text className="text-sm font-bold text-gray-900 dark:text-white">{money(b.total_amount)}</Text>
                  <Pill bgClass={status.bg} textClass={status.text}>
                    {status.label}
                  </Pill>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}
