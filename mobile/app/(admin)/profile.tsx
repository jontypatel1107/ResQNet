import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";
import { api } from "../../src/services/api";
import { Colors } from "../../src/constants/colors";

export default function AdminProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuthStore();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Invalid Input", "Name and phone cannot be empty.");
      return;
    }

    setSaving(true);
    const res = await updateProfile({ name: name.trim(), phone: phone.trim() });
    setSaving(false);

    if (res.success) {
      setIsEditing(false);
      Alert.alert("Success", "Admin profile updated.");
    } else {
      Alert.alert("Error", res.message || "Failed to update profile.");
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      Alert.alert("Incomplete", "Please enter current and new passwords.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Password Length", "New password must be at least 6 characters.");
      return;
    }

    try {
      setChangingPassword(true);
      const res = await api.post("/auth/change-password", { oldPassword, newPassword });
      if (res.data?.success) {
        setOldPassword("");
        setNewPassword("");
        setShowPasswordSection(false);
        Alert.alert("Success", "Admin password successfully updated.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👑</Text>
        </View>
        <Text style={styles.userName}>{name || "Administrator"}</Text>
        <Text style={styles.userEmail}>{user?.email || "admin@resqnet.org"}</Text>

        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>SUPERADMIN PRIVILEGES</Text>
        </View>
      </View>

      {/* Admin Credentials Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Administrator Credentials</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Text style={styles.editBtnText}>{isEditing ? "Cancel" : "Edit"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={[styles.input, !isEditing && styles.inputDisabled]}
          value={name}
          onChangeText={setName}
          editable={isEditing}
        />

        <Text style={styles.label}>Emergency Hotline Contact</Text>
        <TextInput
          style={[styles.input, !isEditing && styles.inputDisabled]}
          value={phone}
          onChangeText={setPhone}
          editable={isEditing}
          keyboardType="phone-pad"
        />

        {isEditing ? (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Security Section */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeaderRow}
          onPress={() => setShowPasswordSection(!showPasswordSection)}
        >
          <Text style={styles.cardTitle}>Security & Credentials</Text>
          <Text style={styles.editBtnText}>{showPasswordSection ? "Hide" : "Change Password"}</Text>
        </TouchableOpacity>

        {showPasswordSection ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Current Master Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor="#8898AA"
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
            />

            <Text style={styles.label}>New Master Password</Text>
            <TextInput
              style={styles.input}
              placeholder="New password (min 6 characters)"
              placeholderTextColor="#8898AA"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TouchableOpacity
              style={styles.passwordBtn}
              onPress={handleChangePassword}
              disabled={changingPassword}
            >
              {changingPassword ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.passwordBtnText}>Update Master Password</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={async () => {
          await logout();
          router.replace("/(auth)/login");
        }}
      >
        <Text style={styles.logoutText}>Terminate Admin Session</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 34,
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: Colors.emergency,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 8,
  },
  roleText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.emergency,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  inputDisabled: {
    backgroundColor: "#EDF2F7",
    color: Colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  passwordBtn: {
    backgroundColor: Colors.emergency,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  passwordBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  logoutBtn: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#FED7D7",
  },
  logoutText: {
    color: Colors.emergencyDark,
    fontSize: 15,
    fontWeight: "700",
  },
});
