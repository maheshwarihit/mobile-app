import { Stethoscope, Brain, Apple } from "lucide-react-native";
import { PhysioIcon } from "@/components/ui/PhysioIcon";

/** Every call site only ever passes `size`/`color` — covers both real Lucide
 * icons and the hand-drawn `PhysioIcon`. */
type ServiceIconComponent = (props: { size?: number; color?: string }) => React.ReactNode;

// One distinct icon per service instead of the same stethoscope everywhere —
// matched by name substring since services are seeded/DB-editable (no
// dedicated icon column), with Stethoscope as the fallback for anything that
// doesn't match one of the four known catalog entries. Shared by the patient
// ServicesScreen and the admin/caregiver booking cards so they never drift.
const SERVICE_ICONS: { match: string; icon: ServiceIconComponent }[] = [
  { match: "para-medical", icon: Stethoscope },
  { match: "mental", icon: Brain },
  { match: "nutrition", icon: Apple },
  { match: "physio", icon: PhysioIcon },
];

export function iconForService(name: string): ServiceIconComponent {
  const lower = name.toLowerCase();
  return SERVICE_ICONS.find((s) => lower.includes(s.match))?.icon ?? Stethoscope;
}
