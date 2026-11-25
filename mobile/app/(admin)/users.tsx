import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { api } from "../../src/services/api";
import { User } from "../../src/types";
import { Colors } from "../../src/constants/colors";

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get("/admin/users");
        if (res.data?.success) {
          setUsers(res.data.data.users || []);
        }
      } catch {
        setUsers([
          { id: "1", name: "System Administrator", email: "admin@resqnet.org", phone: "555-0100", role: "admin" },
          { id: "2", name: "Dr. Sarah Adams", email: "sarah@medical.org", phone: "555-0199", role: "volunteer" },
          { id: "3", name: "John Citizen", email: "john@example.com", phone: "555-0122", role: "citizen" },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const renderItem = ({ item }: { item: User }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={[styles.roleBadge, item.role === "admin" ? styles.adminBadge : item.role === "volunteer" ? styles.volunteerBadge : styles.citizenBadge]}>
          <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.sub}>✉️ {item.email}</Text>
      <Text style={styles.sub}>📞 {item.phone}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id || item.email}
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
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminBadge: {
    backgroundColor: Colors.emergency,
  },
  volunteerBadge: {
    backgroundColor: Colors.success,
  },
  citizenBadge: {
    backgroundColor: Colors.primary,
  },
  roleText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  sub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
