import { Tabs } from "expo-router";
import { Text } from "react-native";
import { Colors } from "../../src/constants/colors";

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.textWhite,
        headerTitleStyle: {
          fontWeight: "700",
        },
        tabBarActiveTintColor: Colors.emergency,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Admin Command Center",
          tabBarLabel: "Overview",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: "User Management",
          tabBarLabel: "Users",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: "Incident Reports",
          tabBarLabel: "Incidents",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📢</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Admin Profile",
          tabBarLabel: "Settings",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
