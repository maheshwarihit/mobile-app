import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AdminStackParamList } from "@/navigation/types";
import { AdminDashboardScreen } from "@/screens/admin/AdminDashboardScreen";
import { LiveSheetScreen } from "@/screens/admin/LiveSheetScreen";
import { AdminPatientListScreen } from "@/screens/admin/AdminPatientListScreen";
import { AdminPatientProfileScreen } from "@/screens/admin/AdminPatientProfileScreen";
import { AdminMemberEditScreen } from "@/screens/admin/AdminMemberEditScreen";
import { AdminPaymentQrScreen } from "@/screens/admin/AdminPaymentQrScreen";
import { AdminPaymentProofsScreen } from "@/screens/admin/AdminPaymentProofsScreen";

const Stack = createNativeStackNavigator<AdminStackParamList>();

// Signed-in shell for role ∈ {staff, admin}. RootNavigator picks this over the
// patient AppNavigator based on the loaded profile role.
export function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="AdminDashboard">
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="LiveSheet" component={LiveSheetScreen} />
      <Stack.Screen name="AdminPatientList" component={AdminPatientListScreen} />
      <Stack.Screen name="AdminPatientProfile" component={AdminPatientProfileScreen} />
      <Stack.Screen name="AdminMemberEdit" component={AdminMemberEditScreen} />
      <Stack.Screen name="AdminPaymentQr" component={AdminPaymentQrScreen} />
      <Stack.Screen name="AdminPaymentProofs" component={AdminPaymentProofsScreen} />
    </Stack.Navigator>
  );
}
