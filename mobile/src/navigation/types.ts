import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { PricingModel, ServiceMode } from "@vagewell/shared";

// ── Booking draft handed Appointment → Payment (via route params) ─
export interface BookingDraft {
  service_id: string;
  service_name: string;
  price_per_day: number;
  pricing_model: PricingModel;
  family_member_id: string | null;
  subject_name: string;
  service_mode: ServiceMode;
  start_date: string;
  num_days: number;
  time_slot: string;
  symptom_brief: string;
}

// ── App tabs (signed-in) ─────────────────────────────────────────
export type ServicesStackParamList = {
  Services: undefined;
  Appointment: { serviceId?: string } | undefined;
  Payment: { draft: BookingDraft };
};

export type AppTabsParamList = {
  ServicesTab: NavigatorScreenParams<ServicesStackParamList> | undefined;
  AppointmentsTab: undefined;
  ProfileTab: undefined;
};

export type ServicesStackScreenProps<T extends keyof ServicesStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<ServicesStackParamList, T>,
  BottomTabScreenProps<AppTabsParamList>
>;

export type AppTabScreenProps<T extends keyof AppTabsParamList> = BottomTabScreenProps<AppTabsParamList, T>;

// ── Ops shells (admin + caregiver) ───────────────────────────────
// The Clients tab is a stack (list → household detail) shared by both ops
// roles; the other tabs are single screens.
export type ClientsStackParamList = {
  ClientsList: undefined;
  // memberId (optional): which specific person to open on — a family member
  // tapped from the list, not the account holder. Omitted, the page opens on
  // the account holder (unchanged default).
  ClientDetail: { accountId: string; memberId?: string };
};

// Admin has no tab/stack param list of its own anymore — `AdminNavigator`
// switches sections with plain `useState` (see `AdminTopNav`), not React
// Navigation, since there's no swipe/URL behavior to preserve, just which
// panel is mounted.
export type CaregiverTabsParamList = {
  MyVisitsTab: undefined;
  CaregiverClientsTab: NavigatorScreenParams<ClientsStackParamList> | undefined;
  OpsProfileTab: undefined;
};

/**
 * The Clients stack is mounted inside both ops tab navigators, so its screens
 * can't name a single parent tab param list. Composing against the stack alone
 * still types `route.params`/`navigation.navigate` within the stack, which is
 * all these two screens actually use.
 */
export type ClientsStackScreenProps<T extends keyof ClientsStackParamList> = NativeStackScreenProps<
  ClientsStackParamList,
  T
>;
