import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Stethoscope, ClipboardList, User } from "lucide-react-native";
import { BRAND } from "@/theme";
import type { ServicesStackParamList, AppTabsParamList } from "@/navigation/types";
import { AppTabBar } from "@/navigation/AppTabBar";
import { ServicesScreen } from "@/screens/ServicesScreen";
import { AppointmentScreen } from "@/screens/AppointmentScreen";
import { PaymentScreen } from "@/screens/PaymentScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { useLanguage } from "@/lib/i18n";

const Stack = createNativeStackNavigator<ServicesStackParamList>();

function ServicesStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Services" component={ServicesScreen} />
      <Stack.Screen name="Appointment" component={AppointmentScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
    </Stack.Navigator>
  );
}

const Tabs = createBottomTabNavigator<AppTabsParamList>();

export function AppNavigator() {
  const { t } = useLanguage();
  return (
    <Tabs.Navigator
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: "#9ca3af",
      }}
    >
      <Tabs.Screen
        name="ServicesTab"
        component={ServicesStackNavigator}
        options={{ title: t("common.tab.services"), tabBarIcon: ({ color, size }) => <Stethoscope size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="AppointmentsTab"
        component={DashboardScreen}
        options={{ title: t("common.tab.appointments"), tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ title: t("common.tab.profile"), tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }}
      />
    </Tabs.Navigator>
  );
}
