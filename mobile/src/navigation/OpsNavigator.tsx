import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Users, User, CalendarCheck, Menu } from "lucide-react-native";
import { BRAND } from "@/theme";
import { useBookingRequests } from "@vagewell/shared";
import type { ClientsStackParamList, CaregiverTabsParamList } from "@/navigation/types";
import { AppTabBar } from "@/navigation/AppTabBar";
import { BrandLogo } from "@/components/ui";
import { AdminSidebar, type AdminSection } from "@/components/ops/AdminSidebar";
import { ProfilePhoto } from "@/components/ops/ProfilePhoto";
import { AdminAppointmentsScreen } from "@/screens/ops/AdminAppointmentsScreen";
import { AdminPaymentQrScreen } from "@/screens/ops/AdminPaymentQrScreen";
import { AdminPaymentProofsScreen } from "@/screens/ops/AdminPaymentProofsScreen";
import { AdminLiveSheetScreen } from "@/screens/ops/AdminLiveSheetScreen";
import { AdminReportsScreen } from "@/screens/ops/AdminReportsScreen";
import { AdminRequestsScreen } from "@/screens/ops/AdminRequestsScreen";
import { AdminTeamScreen } from "@/screens/ops/AdminTeamScreen";
import { AdminUserDetailsScreen } from "@/screens/ops/AdminUserDetailsScreen";
import { MyVisitsScreen } from "@/screens/ops/MyVisitsScreen";
import { OpsClientsScreen } from "@/screens/ops/OpsClientsScreen";
import { OpsClientDetailScreen } from "@/screens/ops/OpsClientDetailScreen";
import { OpsProfileScreen } from "@/screens/ops/OpsProfileScreen";
import { useAuth } from "@/providers/AuthProvider";

const ClientsStack = createNativeStackNavigator<ClientsStackParamList>();

/**
 * Clients list → household detail. Mounted in both ops shells.
 * `initialAccountId` (admin-only, via User Details' tap-through) opens
 * straight on that account's detail instead of the list — the back chevron
 * is hidden in that case (`OpsClientDetailScreen`'s `navigation.canGoBack()`
 * guard) since there's nothing behind it in this stack instance.
 */
function ClientsStackNavigator({ initialAccountId }: { initialAccountId?: string }) {
  return (
    <ClientsStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={initialAccountId ? "ClientDetail" : "ClientsList"}
    >
      <ClientsStack.Screen name="ClientsList" component={OpsClientsScreen} />
      <ClientsStack.Screen
        name="ClientDetail"
        component={OpsClientDetailScreen}
        initialParams={initialAccountId ? { accountId: initialAccountId } : undefined}
      />
    </ClientsStack.Navigator>
  );
}

const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: BRAND,
  tabBarInactiveTintColor: "#9ca3af",
} as const;

/**
 * Admin shell — a thin top bar (hamburger + title + avatar) plus a slide-in
 * drawer (`AdminSidebar`) switching between every admin section. Replaces
 * the horizontal top-nav-bar / wrapping-grid designs (2026-08-11/12): a
 * permanent nav strip of 9 items reads fine on a wide desktop screenshot but
 * is cramped on an actual phone, so the sidebar is hidden by default and
 * opened on demand instead of permanently eating screen space either way.
 * Plain `useState`, not a React Navigation tab navigator: switching sections
 * here has no swipe gesture or URL to preserve, just which panel is mounted,
 * so a lighter custom switcher avoids pulling in a pager-view dependency.
 * `ClientsStackNavigator`/`OpsProfileScreen` are still real (or shared)
 * components — mounting a `NativeStackNavigator` outside of a Tab/Stack
 * ancestor is fine as long as one `NavigationContainer` wraps the app once,
 * which `RootNavigator` already provides.
 */
export function AdminNavigator() {
  const { profile } = useAuth();
  const [active, setActive] = useState<AdminSection>("appointments");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Only set via `openClientDetail` (User Details' tap-through) — cleared on
  // every plain sidebar tap so returning to Clients normally still lands on
  // the list, not a stale previously-opened detail.
  const [clientTarget, setClientTarget] = useState<string | undefined>();
  // Cheap enough to always keep warm for the badge — the same query
  // `AdminRequestsScreen` re-fetches on its own mount regardless.
  const { data: requests } = useBookingRequests(true);
  const unread = (requests ?? []).filter((r) => !r.contacted).length;

  const selectSection = (key: AdminSection) => {
    setClientTarget(undefined);
    setActive(key);
  };
  const openClientDetail = (accountId: string) => {
    setClientTarget(accountId);
    setActive("clients");
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-slate-950" edges={["top"]}>
      <View className="flex-row items-center justify-between bg-[#0B1526] px-4 py-3">
        <Pressable onPress={() => setSidebarOpen(true)} hitSlop={10} className="active:opacity-70">
          <Menu size={22} color="#fff" />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <BrandLogo size={26} transparent />
          <Text className="text-sm font-bold text-white">VAgeWell Care</Text>
        </View>
        <Pressable onPress={() => selectSection("profile")} className="active:opacity-70">
          {profile ? (
            <View className="overflow-hidden rounded-full border-2 border-teal-400/60">
              <ProfilePhoto profile={profile} size={30} />
            </View>
          ) : (
            <View style={{ width: 30, height: 30 }} />
          )}
        </Pressable>
      </View>

      <AdminSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        active={active}
        onSelect={selectSection}
        requestsBadge={unread}
        profile={profile}
      />

      <View className="flex-1">
        {active === "appointments" ? <AdminAppointmentsScreen onOpenClient={openClientDetail} /> : null}
        {active === "requests" ? <AdminRequestsScreen /> : null}
        {active === "userDetails" ? <AdminUserDetailsScreen onOpenClient={openClientDetail} /> : null}
        {active === "clients" ? <ClientsStackNavigator initialAccountId={clientTarget} /> : null}
        {active === "team" ? <AdminTeamScreen onOpenClient={openClientDetail} /> : null}
        {active === "reports" ? <AdminReportsScreen /> : null}
        {active === "liveSheet" ? <AdminLiveSheetScreen /> : null}
        {active === "paymentProofs" ? <AdminPaymentProofsScreen /> : null}
        {active === "paymentQr" ? <AdminPaymentQrScreen /> : null}
        {active === "profile" ? <OpsProfileScreen /> : null}
      </View>
    </SafeAreaView>
  );
}

const CaregiverTabs = createBottomTabNavigator<CaregiverTabsParamList>();

/**
 * Caregiver (leaf_node) shell — their own assigned work plus client lookup.
 * No Requests/Team tabs: `booking_request_select` is admin-only and
 * `set_user_role()` rejects a non-admin caller, so those screens would be
 * empty or error out rather than merely being unhelpful.
 */
export function CaregiverNavigator() {
  return (
    <CaregiverTabs.Navigator tabBar={(props) => <AppTabBar {...props} />} screenOptions={tabScreenOptions}>
      <CaregiverTabs.Screen
        name="MyVisitsTab"
        component={MyVisitsScreen}
        options={{
          title: "My Visits",
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} />,
        }}
      />
      <CaregiverTabs.Screen
        name="CaregiverClientsTab"
        component={ClientsStackNavigator}
        options={{ title: "Clients", tabBarIcon: ({ color, size }) => <Users size={size} color={color} /> }}
      />
      <CaregiverTabs.Screen
        name="OpsProfileTab"
        component={OpsProfileScreen}
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }}
      />
    </CaregiverTabs.Navigator>
  );
}
