import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useTabBarVisibility,
} from "@/components/tab-bar-visibility";
import { AppColors } from "@/constants/app-theme";

type TabRouteName = "index" | "explore" | "chat" | "projects" | "profile";
type BarTab = {
  route: TabRouteName;
  label: string;
  icon: string;
};

const tabs: BarTab[] = [
  { route: "index", label: "Beranda", icon: "⌂" },
  { route: "explore", label: "Cari", icon: "⌕" },
  { route: "chat", label: "Chat", icon: "▱" },
  { route: "projects", label: "Proyek", icon: "▣" },
  { route: "profile", label: "Profil", icon: "○" },
];

async function triggerHaptic() {
  if (Platform.OS === "web") return;
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.selectionAsync();
  } catch (error: unknown) {
    console.warn("Haptic feedback tidak tersedia:", error);
  }
}

function TabButton({
  tab,
  active,
  onPress,
}: {
  tab: BarTab;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        pressed && styles.tabButtonPressed,
      ]}
    >
      <View style={[styles.iconPill, active && styles.iconPillActive]}>
        <Text style={[styles.tabIcon, active && styles.tabIconActive]}>
          {tab.icon}
        </Text>
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {tab.label}
      </Text>
      {active ? <View style={styles.activeDot} /> : <View style={styles.dotSpace} />}
    </Pressable>
  );
}

export function CustomTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name as TabRouteName | undefined;
  const { isTabBarHidden, setSelectedConversationId } =
    useTabBarVisibility();

  const navigateToTab = (route: TabRouteName) => {
    triggerHaptic();
    if (route !== "chat") setSelectedConversationId(null);
    const targetRoute = state.routes.find((item) => item.name === route);
    if (!targetRoute) return;
    const isFocused = state.routes[state.index]?.key === targetRoute.key;
    const event = navigation.emit({
      type: "tabPress",
      target: targetRoute.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route);
    }
  };

  if (activeRoute === "chat" && isTabBarHidden) return null;

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[
          styles.barPosition,
          { bottom: Math.max(insets.bottom, 8) + 12 },
        ]}
      >
        <View accessibilityRole="tablist" style={styles.bar}>
          {tabs.map((tab) => (
            <TabButton
              key={tab.route}
              tab={tab}
              active={activeRoute === tab.route}
              onPress={() => navigateToTab(tab.route)}
            />
          ))}
        </View>
      </View>
    </>
  );
}

export function SisworkTabs() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
        sceneStyle: { backgroundColor: AppColors.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Beranda" }} />
      <Tabs.Screen name="explore" options={{ title: "Cari" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="projects" options={{ title: "Proyek" }} />
      <Tabs.Screen name="orders" options={{ title: "Pesanan" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barPosition: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  bar: {
    width: "100%",
    maxWidth: 520,
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    shadowColor: "#172033",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 9,
  },
  tabButton: {
    flex: 1,
    minWidth: 44,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabButtonPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  iconPill: {
    width: 38,
    height: 30,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPillActive: { backgroundColor: AppColors.brandTint },
  tabIcon: { color: "#929AAF", fontSize: 21, lineHeight: 25 },
  tabIconActive: { color: AppColors.brand },
  tabLabel: { color: "#8992A5", fontSize: 11, fontWeight: "700" },
  tabLabelActive: { color: AppColors.brand },
  activeDot: {
    position: "absolute",
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.brand,
  },
  dotSpace: { height: 4 },
});
