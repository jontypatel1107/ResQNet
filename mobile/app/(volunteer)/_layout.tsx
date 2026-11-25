import { Tabs } from "expo-router";
import { Text } from "react-native";
import { Colors } from "../../src/constants/colors";

export default function VolunteerLayout() {
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
        tabBarActiveTintColor: Colors.success,
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
          title: "Volunteer Ops",
          tabBarLabel: "Dashboard",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🩺</Text>,
        }}
      />
      <Tabs.Screen
        name="nearby-requests"
        options={{
          title: "Disaster Zone",
          tabBarLabel: "Nearby SOS",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📍</Text>,
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: "My Missions",
          tabBarLabel: "Assignments",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🎯</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Responder Profile",
          tabBarLabel: "Profile",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🛡️</Text>,
        }}
      />
    </Tabs>
  );
}
