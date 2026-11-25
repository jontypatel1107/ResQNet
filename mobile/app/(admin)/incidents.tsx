import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { api } from "../../src/services/api";
import { Colors } from "../../src/constants/colors";

export default function AdminIncidents() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await api.get("/admin/incidents");
        if (res.data?.success) {
          setIncidents(res.data.data.incidents || []);
        }
      } catch {
        setIncidents([
          {
            _id: "inc-1",
            title: "River Overflow Near Sector 4",
            category: "flood",
            status: "reviewed",
            description: "Water levels rose 2 feet above embankment.",
          },
          {
            _id: "inc-2",
            title: "Road Obstruction by Fallen Power Line",
            category: "road_blockage",
            status: "pending",
            description: "High tension wire snapped across main route.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchIncidents();
  }, []);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.category.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.desc}>{item.description}</Text>
      <Text style={styles.status}>Status: {item.status}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: "800",
  },
  desc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  status: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
  },
});
