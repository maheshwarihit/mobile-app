import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

const cardShadow = { elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } };

/** Base white card */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <View style={cardShadow} className={`rounded-xl border border-gray-100 bg-white ${className}`}>
      {children}
    </View>
  );
}

/** Form section card with icon header */
export function SectionCard({
  icon: Icon,
  iconBg = "bg-purple-50",
  iconColor = "#9333ea",
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={cardShadow} className="mb-5 rounded-xl border border-gray-100 bg-white p-5">
      <View className="mb-5 flex-row items-center gap-3">
        <View className={`h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon size={18} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{title}</Text>
          {subtitle ? <Text className="text-sm text-gray-500">{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/** Page header with title, subtitle, and optional action node */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View className="mb-5 flex-row items-start justify-between">
      <View className="flex-1">
        <Text className="text-2xl font-bold text-gray-900">{title}</Text>
        {subtitle ? <Text className="mt-1 text-sm text-gray-500">{subtitle}</Text> : null}
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}
