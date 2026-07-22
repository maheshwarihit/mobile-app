import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "./runtime";
import { qk } from "./queryClient";
import type {
  Service,
  Booking,
  FamilyMember,
  Profile,
  ClinicalRecord,
  BookingWithNames,
} from "./types";

// ── Services (SERVICE_LIST / APPOINTMENT) ────────────────────────
export function useServices(includeInactive = false) {
  return useQuery({
    queryKey: [...qk.services, includeInactive],
    queryFn: async (): Promise<Service[]> => {
      const sb = getSupabase();
      let q = sb.from("services").select("*").order("price_per_day", { ascending: true });
      if (!includeInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });
}

// ── Family members / dependents (PROFILE / APPOINTMENT) ──────────
export function useFamilyMembers() {
  return useQuery({
    queryKey: qk.familyMembers,
    queryFn: async (): Promise<FamilyMember[]> => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("family_members")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FamilyMember[];
    },
  });
}

// ── Dependents for a specific account (admin patient drill-down) ─
export function useFamilyMembersByAccount(accountId: string | null) {
  return useQuery({
    queryKey: qk.familyMembersByAccount(accountId ?? ""),
    enabled: !!accountId,
    queryFn: async (): Promise<FamilyMember[]> => {
      const sb = getSupabase();
      // Staff/admin RLS (fam_select) returns all rows; scope to this account.
      const { data, error } = await sb
        .from("family_members")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FamilyMember[];
    },
  });
}

// ── Patient's own bookings (DASHBOARD) ───────────────────────────
export function useMyBookings() {
  return useQuery({
    queryKey: qk.bookings("mine"),
    queryFn: async (): Promise<Booking[]> => {
      const sb = getSupabase();
      // Explicitly scope to the caller. RLS lets staff/admin read ALL rows,
      // so without this filter the "My Appointments" tab would show everyone's.
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return [];
      const { data, error } = await sb
        .from("bookings")
        .select("*")
        .eq("account_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });
}

// ── All bookings with names (staff/admin DASHBOARD + export) ─────
export function useAllBookings(enabled: boolean) {
  return useQuery({
    queryKey: qk.bookings("all"),
    enabled,
    queryFn: async (): Promise<BookingWithNames[]> => {
      const sb = getSupabase();
      // RLS gives staff/admin every row; join names via related selects.
      const { data, error } = await sb
        .from("bookings")
        .select("*, account:profiles!bookings_account_id_fkey(full_name, phone), dependent:family_members(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => {
        const account = row.account as { full_name: string | null; phone: string | null } | null;
        const dependent = row.dependent as { full_name: string } | null;
        return {
          ...(row as unknown as Booking),
          account: account ?? undefined,
          subject_name: dependent?.full_name ?? account?.full_name ?? null,
        } as BookingWithNames;
      });
    },
  });
}

// ── Clinical records for a subject (PROFILE) ─────────────────────
export function useClinicalRecords(subject: { profileId?: string; familyMemberId?: string } | null) {
  const key = subject?.profileId
    ? `p:${subject.profileId}`
    : subject?.familyMemberId
      ? `f:${subject.familyMemberId}`
      : "none";
  return useQuery({
    queryKey: qk.clinical(key),
    enabled: !!subject && (!!subject.profileId || !!subject.familyMemberId),
    queryFn: async (): Promise<ClinicalRecord[]> => {
      const sb = getSupabase();
      let q = sb.from("clinical_records").select("*").order("recorded_at", { ascending: false });
      if (subject?.profileId) q = q.eq("profile_id", subject.profileId);
      else if (subject?.familyMemberId) q = q.eq("family_member_id", subject.familyMemberId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ClinicalRecord[];
    },
  });
}

// ── All users (admin Role Manager) ───────────────────────────────
export function useAllProfiles(enabled: boolean) {
  return useQuery({
    queryKey: qk.users,
    enabled,
    queryFn: async (): Promise<Profile[]> => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}
