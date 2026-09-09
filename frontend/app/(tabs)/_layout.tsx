import React from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform, StatusBar, TouchableOpacity } from "react-native";
import { lightTheme } from "../../src/components/NeumorphicUI";
import { useBillsStore } from "../../src/store/billsStore";

export default function TabLayout() {
  const router = useRouter();
  const billsDueSoonCount = useBillsStore((s) => s.dueSoonCount);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={lightTheme.colors.background} />
      <Tabs
        screenOptions={{
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: "#FF3B30",
          tabBarInactiveTintColor: "#8E8E93",
          tabBarShowLabel: true,
          tabBarLabelStyle: styles.tabLabel,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => (
              <View style={styles.tabIconContainer}>
                <Ionicons name="home-outline" size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: "Trans.",
            tabBarIcon: ({ color }) => (
              <View style={styles.tabIconContainer}>
                <Ionicons name="document-text-outline" size={20} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: "",
            tabBarButton: (props) => (
              <TouchableOpacity
                {...(props as any)}
                style={styles.fabTabButton}
                onPress={() => router.push("/(tabs)/add")}
                activeOpacity={0.85}
              >
                <View style={styles.fab}>
                  <Ionicons name="add" size={28} color="#FFF" />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="bills"
          options={{
            title: "Bills",
            tabBarBadge: billsDueSoonCount > 0 ? billsDueSoonCount : undefined,
            tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "More",
            tabBarIcon: ({ color }) => (
              <Ionicons name="ellipsis-horizontal" size={20} color={color} />
            ),
          }}
        />
        {/* Reachable via Home's quick actions + More's Quick Links, not the dock —
            keeps the dock to 5 slots instead of 8. */}
        <Tabs.Screen name="stats" options={{ href: null }} />
        <Tabs.Screen name="budgets" options={{ href: null }} />
        <Tabs.Screen name="goals" options={{ href: null }} />
        <Tabs.Screen name="net-worth" options={{ href: null }} />
        <Tabs.Screen
          name="accounts"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 0.5,
    borderTopColor: "#E5E5EA",
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    height: Platform.OS === "ios" ? 84 : 64,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  tabIconContainer: {
    alignItems: "center",
  },
  fabTabButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: Platform.OS === "ios" ? -28 : -24,
    backgroundColor: "#FF6B6B",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
