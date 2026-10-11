import { useState } from "react";
import { Tabs, useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useTabBarVisibility,
} from "@/components/tab-bar-visibility";

type TabRouteName = "index" | "chat" | "projects" | "profile";
type BarTab = {
  route: TabRouteName;
  label: string;
  icon: string;
};

const leftTabs: BarTab[] = [
  { route: "index", label: "Home", icon: "⌂" },
  { route: "chat", label: "Chat", icon: "▱" },
];
const rightTabs: BarTab[] = [
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
  const router = useRouter();
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const activeRoute = state.routes[state.index]?.name as TabRouteName | undefined;
  const { isTabBarHidden } = useTabBarVisibility();

  const navigateToTab = (route: TabRouteName) => {
    triggerHaptic();
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

  const openAction = (action: "portfolio" | "service") => {
    triggerHaptic();
    setIsActionSheetOpen(false);
    router.push({
      pathname: "/(tabs)/profile",
      params: { action, actionId: String(Date.now()) },
    });
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
        <View style={styles.bar}>
          {leftTabs.map((tab) => (
            <TabButton
              key={tab.route}
              tab={tab}
              active={activeRoute === tab.route}
              onPress={() => navigateToTab(tab.route)}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka menu tambah"
            accessibilityHint="Pilih untuk mengunggah karya atau membuka jasa"
            onPress={() => {
              triggerHaptic();
              setIsActionSheetOpen(true);
            }}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={styles.actionIcon}>＋</Text>
            <Text style={styles.actionLabel}>Buat</Text>
          </Pressable>
          {rightTabs.map((tab) => (
            <TabButton
              key={tab.route}
              tab={tab}
              active={activeRoute === tab.route}
              onPress={() => navigateToTab(tab.route)}
            />
          ))}
        </View>
      </View>

      <Modal
        visible={isActionSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsActionSheetOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup menu tambah"
            onPress={() => setIsActionSheetOpen(false)}
            style={styles.backdropDismiss}
          />
          <View
            style={[
              styles.actionSheet,
              { paddingBottom: Math.max(insets.bottom, 18) },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>AKSI CEPAT</Text>
            <Text style={styles.sheetTitle}>Apa yang ingin kamu bagikan?</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => openAction("portfolio")}
              style={({ pressed }) => [
                styles.actionOption,
                pressed && styles.actionOptionPressed,
              ]}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.optionIconText}>▧</Text>
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>Unggah Karya</Text>
                <Text style={styles.optionDescription}>
                  Tambahkan karya baru ke portofoliomu
                </Text>
              </View>
              <Text style={styles.optionArrow}>›</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => openAction("service")}
              style={({ pressed }) => [
                styles.actionOption,
                pressed && styles.actionOptionPressed,
              ]}
            >
              <View style={[styles.optionIcon, styles.serviceOptionIcon]}>
                <Text style={styles.optionIconText}>💼</Text>
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>Buka Jasa</Text>
                <Text style={styles.optionDescription}>
                  Tawarkan keahlianmu kepada teman sekolah
                </Text>
              </View>
              <Text style={styles.optionArrow}>›</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
        sceneStyle: { backgroundColor: "#F7F8FC" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="projects" options={{ title: "Proyek" }} />
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
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 7,
    paddingVertical: 7,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    shadowColor: "#172033",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 9,
  },
  tabButton: {
    flex: 1,
    minWidth: 48,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  tabButtonPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  iconPill: {
    width: 35,
    height: 29,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPillActive: { backgroundColor: "#EEF0FF" },
  tabIcon: { color: "#929AAF", fontSize: 21, lineHeight: 25 },
  tabIconActive: { color: "#4F46E5" },
  tabLabel: { color: "#8992A5", fontSize: 9, fontWeight: "700" },
  tabLabelActive: { color: "#4F46E5" },
  activeDot: {
    position: "absolute",
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4F46E5",
  },
  dotSpace: { height: 4 },
  actionButton: {
    width: 57,
    height: 57,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 3,
    marginTop: -22,
    borderRadius: 21,
    backgroundColor: "#4F46E5",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 8,
  },
  actionButtonPressed: { opacity: 0.86, transform: [{ scale: 0.94 }] },
  actionIcon: { color: "#FFFFFF", fontSize: 28, lineHeight: 31 },
  actionLabel: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800",
    marginTop: -1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(25, 33, 53, 0.35)",
  },
  backdropDismiss: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  actionSheet: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingTop: 11,
    paddingHorizontal: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: "#FFFFFF",
  },
  sheetHandle: {
    width: 38,
    height: 4,
    alignSelf: "center",
    marginBottom: 18,
    borderRadius: 2,
    backgroundColor: "#D8DCE5",
  },
  sheetEyebrow: {
    color: "#8992A5",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  sheetTitle: {
    color: "#202B42",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 5,
    marginBottom: 15,
  },
  actionOption: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: "#ECEFF5",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  actionOptionPressed: { backgroundColor: "#F5F6FA" },
  optionIcon: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#EEF0FF",
  },
  serviceOptionIcon: { backgroundColor: "#FFF3E8" },
  optionIconText: { color: "#4F46E5", fontSize: 21 },
  optionCopy: { flex: 1 },
  optionTitle: { color: "#293650", fontSize: 12, fontWeight: "800" },
  optionDescription: { color: "#8790A2", fontSize: 10, marginTop: 4 },
  optionArrow: { color: "#A0A8B7", fontSize: 24 },
});
