import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Stethoscope, ClipboardList, User } from "lucide-react-native";
import type { ServicesStackParamList, AppTabsParamList } from "@/navigation/types";
import { ServicesScreen } from "@/screens/ServicesScreen";
import { AppointmentScreen } from "@/screens/AppointmentScreen";
import { PaymentScreen } from "@/screens/PaymentScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";

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
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#9333ea",
        tabBarInactiveTintColor: "#9ca3af",
      }}
    >
      <Tabs.Screen
        name="ServicesTab"
        component={ServicesStackNavigator}
        options={{ title: "Services", tabBarIcon: ({ color, size }) => <Stethoscope size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="AppointmentsTab"
        component={DashboardScreen}
        options={{ title: "Appointments", tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }}
      />
    </Tabs.Navigator>
  );
}
