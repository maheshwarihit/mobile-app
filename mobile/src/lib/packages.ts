import { Award, Crown, Medal, type LucideIcon } from "lucide-react-native";
import { BRAND } from "@/theme";

// TODO: placeholder tier names/pricing/benefits — marketing-only display for
// now (not a real bookable product, no DB backing). Confirm actual content
// with the client, then replace before this goes live for real customers.
// Shared between the pre-login HomeScreen and the post-login ServicesScreen
// so the two never drift apart.
export type PremiumPackage = {
  tier: string;
  icon: LucideIcon;
  accent: { bg: string; icon: string; text: string };
  price: string;
  benefits: string[];
};

export const PACKAGES: PremiumPackage[] = [
  {
    tier: "Silver",
    icon: Medal,
    accent: { bg: "bg-gray-100", icon: "#6b7280", text: "text-gray-700" },
    price: "₹1,999/month",
    benefits: ["1 service of your choice", "Monthly progress check-in", "WhatsApp support"],
  },
  {
    tier: "Gold",
    icon: Award,
    accent: { bg: "bg-amber-50", icon: "#b45309", text: "text-amber-700" },
    price: "₹3,999/month",
    benefits: ["Any 2 services combined", "Priority scheduling", "Monthly health report"],
  },
  {
    tier: "Platinum",
    icon: Crown,
    accent: { bg: "bg-purple-50", icon: BRAND, text: "text-purple-700" },
    price: "₹6,999/month",
    benefits: ["All 4 services included", "Dedicated care coordinator", "24×7 priority support"],
  },
];
