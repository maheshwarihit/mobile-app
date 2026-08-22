import { Stethoscope, Brain, Apple, Activity, type LucideIcon } from "lucide-react-native";

// One distinct icon per service instead of the same stethoscope everywhere —
// matched by name substring since services are seeded/DB-editable (no
// dedicated icon column), with Stethoscope as the fallback for anything that
// doesn't match one of the four known catalog entries. Shared by the patient
// ServicesScreen and the admin/caregiver booking cards so they never drift.
const SERVICE_ICONS: { match: string; icon: LucideIcon }[] = [
  { match: "para-medical", icon: Stethoscope },
  { match: "mental", icon: Brain },
  { match: "nutrition", icon: Apple },
  { match: "physio", icon: Activity },
];

export function iconForService(name: string): LucideIcon {
  const lower = name.toLowerCase();
  return SERVICE_ICONS.find((s) => lower.includes(s.match))?.icon ?? Stethoscope;
}
