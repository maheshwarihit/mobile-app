import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";

// ── Auth stack (signed-out) ──────────────────────────────────────
export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
};
export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;

// ── Booking draft handed Appointment → Payment (via route params) ─
export interface BookingDraft {
  service_id: string;
  service_name: string;
  price_per_day: number;
  family_member_id: string | null;
  subject_name: string;
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
  ServicesTab: undefined;
  AppointmentsTab: undefined;
  ProfileTab: undefined;
};

export type ServicesStackScreenProps<T extends keyof ServicesStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<ServicesStackParamList, T>,
  BottomTabScreenProps<AppTabsParamList>
>;
