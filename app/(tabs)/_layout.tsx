import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { palette } from "@/src/theme/colors";

export default function TabLayout() {
  const scheme = useColorScheme() ?? "light";
  const colors = palette[scheme];

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          height: 84,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: "700",
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="connect-bank"
        options={{
          title: "Bank",
          tabBarLabel: "Bank",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="link" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="ai"
        options={{
          title: "AI Coach",
          tabBarLabel: "Coach",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="sparkles"
              size={size ?? 26}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="insights"
        options={{
          title: "AI Insights",
          tabBarLabel: "Insights",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart" size={size ?? 26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}