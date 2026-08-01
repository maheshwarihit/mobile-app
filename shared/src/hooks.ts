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
  ReportUpload,
  BookingRequestWithAccount,
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

// ── Every dependent across all accounts (staff/admin patient search) ─
export function useAllFamilyMembers(enabled: boolean) {
  return useQuery({
    queryKey: qk.familyMembersAll,
    enabled,
    queryFn: async (): Promise<FamilyMember[]> => {
      const sb = getSupabase();
      // Staff/admin RLS (fam_select) returns every row; patients would only ever
      // see their own, so this hook is gated to the admin shell by `enabled`.
      const { data, error } = await sb
        .from("family_members")
        .select("*")
        .order("full_name", { ascending: true });
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

const BOOKING_WITH_NAMES_SELECT =
  "*, account:profiles!bookings_account_id_fkey(full_name, phone, age), dependent:family_members(full_name, relationship, age, contact_phone), assignee:profiles!bookings_assigned_to_fkey(full_name)";

function mapBookingWithNames(row: Record<string, unknown>): BookingWithNames {
  const account = row.account as Pick<Profile, "full_name" | "phone" | "age"> | null;
  const dependent = row.dependent as Pick<
    FamilyMember,
    "full_name" | "relationship" | "age" | "contact_phone"
  > | null;
  const assignee = row.assignee as Pick<Profile, "full_name"> | null;
  return {
    ...(row as unknown as Booking),
    account: account ?? undefined,
    subject_name: dependent?.full_name ?? account?.full_name ?? null,
    subject_relationship: dependent?.relationship ?? "self",
    subject_age: dependent ? dependent.age : account?.age ?? null,
    subject_phone: dependent ? dependent.contact_phone : account?.phone ?? null,
    assigned_to_name: assignee?.full_name ?? null,
  } as BookingWithNames;
}

// ── All bookings with names (admin DASHBOARD + export) ────────────
export function useAllBookings(enabled: boolean) {
  return useQuery({
    queryKey: qk.bookings("all"),
    enabled,
    queryFn: async (): Promise<BookingWithNames[]> => {
      const sb = getSupabase();
      // RLS gives admin every row (and gives plain staff/leaf_node only their
      // assigned rows — see useMyAssignedBookings for that dedicated view).
      // Newest appointment first — the date every card and sheet row renders is
      // start_date, so ordering on created_at made the visible column look
      // unsorted. created_at only breaks ties within a day.
      const { data, error } = await sb
        .from("bookings")
        .select(BOOKING_WITH_NAMES_SELECT)
        .order("start_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapBookingWithNames);
    },
  });
}

// ── This staff/leaf_node member's assigned bookings (web MY VISITS) ─────
export function useMyAssignedBookings(enabled: boolean) {
  return useQuery({
    queryKey: qk.bookings("assigned"),
    enabled,
    queryFn: async (): Promise<BookingWithNames[]> => {
      const sb = getSupabase();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return [];
      // RLS already scopes non-admin staff/leaf_node to assigned_to = auth.uid(),
      // but filter explicitly so an admin opening this page sees the same
      // "my work" view rather than everything.
      const { data, error } = await sb
        .from("bookings")
        .select(BOOKING_WITH_NAMES_SELECT)
        .eq("assigned_to", user.id)
        .order("start_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapBookingWithNames);
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

// ── All clinical records (staff/admin LIVE SHEET) ────────────────
export function useAllClinicalRecords(enabled: boolean) {
  return useQuery({
    queryKey: qk.clinical("all"),
    enabled,
    queryFn: async (): Promise<ClinicalRecord[]> => {
      const sb = getSupabase();
      // RLS (clin_select) gives staff/admin every row. No name embeds: the live
      // sheet keys these to bookings by profile_id / family_member_id and takes
      // the patient name from the booking side.
      const { data, error } = await sb
        .from("clinical_records")
        .select("*")
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClinicalRecord[];
    },
  });
}

// ── All users (admin Role Manager, Staff/Leaf Node lists) ────────
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

// ── Reports for one booking (patient REPORTS tab, admin/staff visit view) ───
export function useReportsForBooking(bookingId: string | null) {
  return useQuery({
    queryKey: qk.reports(bookingId ?? "none"),
    enabled: !!bookingId,
    queryFn: async (): Promise<ReportUpload[]> => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("report_uploads")
        .select("*")
        .eq("booking_id", bookingId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportUpload[];
    },
  });
}

// ── Every reviewed report visible to the caller's household (patient REPORTS tab) ──
export function useMyReports(enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "__mine__"] as const,
    enabled,
    queryFn: async (): Promise<ReportUpload[]> => {
      const sb = getSupabase();
      // RLS (report_select) already restricts non-staff callers to reviewed
      // rows for their own household's bookings.
      const { data, error } = await sb
        .from("report_uploads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportUpload[];
    },
  });
}

// ── Unreviewed reports (admin REPORTS review page) ────────────────
export function useUnreviewedReports(enabled: boolean) {
  return useQuery({
    queryKey: qk.reportsUnreviewed,
    enabled,
    queryFn: async (): Promise<ReportUpload[]> => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("report_uploads")
        .select("*")
        .eq("reviewed", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportUpload[];
    },
  });
}

// ── Every report, reviewed or not (staff/leaf_node/admin Reports page) ──
// RLS (report_select) already grants any is_staff() caller every row
// regardless of whose booking it's on — patient_name/service_name are
// snapshotted onto the row itself (0014), so no separate bookings join
// is needed (and would fail to resolve for staff/leaf_node anyway, since
// bookings RLS scopes them to only their own assigned rows).
export function useAllReports(enabled: boolean) {
  return useQuery({
    queryKey: qk.reportsAll,
    enabled,
    queryFn: async (): Promise<ReportUpload[]> => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("report_uploads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportUpload[];
    },
  });
}

// ── Booking requests — "Request for Booking" inbox (admin panel only) ────────
export function useBookingRequests(enabled: boolean) {
  return useQuery({
    queryKey: qk.bookingRequests,
    enabled,
    queryFn: async (): Promise<BookingRequestWithAccount[]> => {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("booking_requests")
        .select("*, account:profiles!booking_requests_account_id_fkey(full_name, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BookingRequestWithAccount[];
    },
  });
}
