import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  RefreshControl,
  FlatList,
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as Contacts from "expo-contacts/legacy";
import * as Battery from "expo-battery";
import NetInfo from "@react-native-community/netinfo";
import {
  getTrustedCircle,
  addTrustedContact,
  updateTrustedContact,
  deleteTrustedContact,
  updateTrustedCircleSettings,
  sendTestAlert,
} from "../../src/services/trustedCircleService";
import { TrustedContact, TrustedCircleSettings, RelationshipType } from "../../src/types";
import { Colors } from "../../src/constants/colors";

const RELATIONSHIPS: RelationshipType[] = [
  "Family",
  "Parent",
  "Spouse",
  "Sibling",
  "Child",
  "Friend",
  "Doctor",
  "Colleague",
  "Other",
];

export default function TrustedCircleScreen() {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [settings, setSettings] = useState<TrustedCircleSettings>({
    autoAlertEnabled: true,
    includeLiveLocation: true,
    notifyOnCriticalOnly: false,
    customAlertMessage: "EMERGENCY SOS: I need urgent help! My live location and situation are being tracked on ResQNet:",
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState<"choice" | "manual" | "picker" | "configure">("choice");
  const [testingAlert, setTestingAlert] = useState(false);

  // Device Contacts State
  const [deviceContacts, setDeviceContacts] = useState<any[]>([]);
  const [filteredDeviceContacts, setFilteredDeviceContacts] = useState<any[]>([]);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState("");
  const [loadingDeviceContacts, setLoadingDeviceContacts] = useState(false);

  // New Contact Form State
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelation, setNewRelation] = useState<RelationshipType>("Family");
  const [newSms, setNewSms] = useState(true);
  const [newWhatsApp, setNewWhatsApp] = useState(true);
  const [addingContact, setAddingContact] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getTrustedCircle();
      if (data) {
        setContacts(data.contacts || []);
        if (data.settings) setSettings(data.settings);
      }
    } catch (err: any) {
      console.warn("Could not load Trusted Circle:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      getTrustedCircle()
        .then((data) => {
          if (isMounted && data) {
            setContacts(data.contacts || []);
            if (data.settings) setSettings(data.settings);
          }
        })
        .catch((err) => {
          console.warn("Could not load Trusted Circle:", err.message);
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
            setRefreshing(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }, [])
  );

  const handleToggleContactSOS = async (contact: TrustedContact) => {
    if (!contact._id) return;
    const updatedStatus = !contact.notifyOnSOS;
    setContacts((prev) =>
      prev.map((c) => (c._id === contact._id ? { ...c, notifyOnSOS: updatedStatus } : c))
    );

    try {
      await updateTrustedContact(contact._id, { notifyOnSOS: updatedStatus });
    } catch {
      Alert.alert("Error", "Could not update contact preference.");
      loadData();
    }
  };

  const handleDeleteContact = (contact: TrustedContact) => {
    if (!contact._id) return;
    Alert.alert(
      "Remove Contact",
      `Are you sure you want to remove ${contact.name} from your Trusted Circle?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const updated = await deleteTrustedContact(contact._id!);
              setContacts(updated);
            } catch (err: any) {
              Alert.alert("Error", err.response?.data?.message || "Failed to remove contact.");
            }
          },
        },
      ]
    );
  };

  const handlePickFromDeviceContacts = async () => {
    try {
      setLoadingDeviceContacts(true);
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission to access contacts was denied. You can add contacts manually."
        );
        setLoadingDeviceContacts(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      if (data && data.length > 0) {
        const validContacts = data.filter((c: any) => c.phoneNumbers && c.phoneNumbers.length > 0);
        setDeviceContacts(validContacts);
        setFilteredDeviceContacts(validContacts);
        setModalStep("picker");
      } else {
        Alert.alert("No Contacts", "No contacts with phone numbers found on your device.");
      }
    } catch {
      Alert.alert("Error", "Could not load device contacts.");
    } finally {
      setLoadingDeviceContacts(false);
    }
  };

  const handleSearchDeviceContacts = (query: string) => {
    setDeviceSearchQuery(query);
    if (!query.trim()) {
      setFilteredDeviceContacts(deviceContacts);
      return;
    }
    const q = query.toLowerCase();
    const filtered = deviceContacts.filter((c: any) => {
      const nameMatch = c.name?.toLowerCase().includes(q);
      const phoneMatch = c.phoneNumbers?.some((p: any) => p.number?.includes(q));
      return nameMatch || phoneMatch;
    });
    setFilteredDeviceContacts(filtered);
  };

  const handleSelectDeviceContact = (contact: any) => {
    const phoneNumbers = contact.phoneNumbers || [];
    if (phoneNumbers.length === 1) {
      const phone = phoneNumbers[0].number || "";
      setNewName(contact.name || "Trusted Contact");
      setNewPhone(phone);
      setModalStep("configure");
    } else if (phoneNumbers.length > 1) {
      Alert.alert(
        "Select Phone Number",
        `Multiple numbers found for ${contact.name}:`,
        phoneNumbers
          .map((p: any) => ({
            text: `${p.label || "mobile"}: ${p.number}`,
            onPress: () => {
              setNewName(contact.name || "Trusted Contact");
              setNewPhone(p.number || "");
              setModalStep("configure");
            },
          }))
          .concat([{ text: "Cancel", style: "cancel" }] as any)
      );
    }
  };

  const handleAddContactSubmit = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert("Incomplete", "Please provide a name and phone number.");
      return;
    }

    const cleanPhone = newPhone.trim().replace(/\s+/g, "");
    if (cleanPhone.length < 8) {
      Alert.alert("Invalid Phone", "Please enter a valid phone number with country/area code.");
      return;
    }

    const notifyVia: ("sms" | "whatsapp")[] = [];
    if (newSms) notifyVia.push("sms");
    if (newWhatsApp) notifyVia.push("whatsapp");

    if (notifyVia.length === 0) {
      Alert.alert("Select Channel", "Please select at least one notification channel (SMS or WhatsApp).");
      return;
    }

    try {
      setAddingContact(true);
      const updated = await addTrustedContact({
        name: newName.trim(),
        phone: cleanPhone,
        relationship: newRelation,
        notifyOnSOS: true,
        notifyVia,
      });

      setContacts(updated);
      setModalVisible(false);
      setModalStep("choice");
      setNewName("");
      setNewPhone("");
      setNewRelation("Family");
      setNewSms(true);
      setNewWhatsApp(true);
      Alert.alert("Contact Added", `${newName} has been added to your Trusted Circle.`);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Could not add contact.");
    } finally {
      setAddingContact(false);
    }
  };

  const handleUpdateSetting = async (key: keyof TrustedCircleSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    try {
      await updateTrustedCircleSettings({ [key]: value });
    } catch {
      Alert.alert("Error", "Could not save setting.");
      loadData();
    }
  };

  const handleSendTestAlert = async () => {
    if (contacts.length === 0) {
      Alert.alert("No Contacts", "Please add at least one trusted contact before sending a test alert.");
      return;
    }

    try {
      setTestingAlert(true);
      let batteryLevel: number | null = null;
      try {
        const bLevel = await Battery.getBatteryLevelAsync();
        if (bLevel >= 0) {
          batteryLevel = Math.round(bLevel * 100);
        }
      } catch {}

      let networkStatus = "online";
      try {
        const netState = await NetInfo.fetch();
        networkStatus = netState.isConnected ? (netState.type || "online") : "offline";
      } catch {}

      const res = await sendTestAlert({ batteryLevel, networkStatus });
      const notifiedCount = res.dispatchResult?.contactsNotified || 0;
      Alert.alert(
        "Test Alert Dispatched! 🚀",
        `Simulated emergency SOS transmitted to ${notifiedCount} trusted contact(s) with live tracking link and GPS coordinates.`
      );
    } catch (err: any) {
      Alert.alert("Test Failed", err.response?.data?.message || "Could not send test alert.");
    } finally {
      setTestingAlert(false);
    }
  };

  const openAddModal = () => {
    setModalStep("choice");
    setNewName("");
    setNewPhone("");
    setNewRelation("Family");
    setNewSms(true);
    setNewWhatsApp(true);
    setDeviceSearchQuery("");
    setModalVisible(true);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
        />
      }
    >
      {/* Header Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Text style={{ fontSize: 32 }}>🛡️</Text>
        </View>
        <Text style={styles.bannerTitle}>Trusted Circle</Text>
        <Text style={styles.bannerSubtitle}>
          Extend emergency response beyond platform volunteers. Automatically notify your closest
          family, friends and doctors with live GPS tracking on SOS.
        </Text>

        <View style={styles.statusPillRow}>
          <View
            style={[
              styles.statusPill,
              settings.autoAlertEnabled ? styles.statusPillActive : styles.statusPillInactive,
            ]}
          >
            <Text style={styles.statusPillText}>
              {settings.autoAlertEnabled ? "● AUTO-ALERT ACTIVE" : "○ AUTO-ALERT DISABLED"}
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{contacts.length} Contact(s)</Text>
          </View>
        </View>
      </View>

      {/* Consent & Privacy Controls */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Consent & Alert Controls</Text>
        <Text style={styles.cardSub}>
          Control how and when your trusted contacts are alerted during emergencies.
        </Text>

        <View style={styles.controlRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.controlTitle}>Auto-Alert on Emergency SOS</Text>
            <Text style={styles.controlDesc}>
              Instantly broadcast SMS / WhatsApp to your circle when SOS is triggered.
            </Text>
          </View>
          <Switch
            value={settings.autoAlertEnabled}
            onValueChange={(val) => handleUpdateSetting("autoAlertEnabled", val)}
            trackColor={{ false: "#CBD5E0", true: "#68D391" }}
            thumbColor={settings.autoAlertEnabled ? Colors.success : "#A0AEC0"}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.controlRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.controlTitle}>Include Live GPS Tracking Link</Text>
            <Text style={styles.controlDesc}>
              Allows contacts to open a live map with responder status directly in their browser.
            </Text>
          </View>
          <Switch
            value={settings.includeLiveLocation}
            onValueChange={(val) => handleUpdateSetting("includeLiveLocation", val)}
            trackColor={{ false: "#CBD5E0", true: "#68D391" }}
            thumbColor={settings.includeLiveLocation ? Colors.success : "#A0AEC0"}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.controlRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.controlTitle}>Critical Priority Only</Text>
            <Text style={styles.controlDesc}>
              Only dispatch alerts when an emergency is marked as Critical.
            </Text>
          </View>
          <Switch
            value={settings.notifyOnCriticalOnly}
            onValueChange={(val) => handleUpdateSetting("notifyOnCriticalOnly", val)}
            trackColor={{ false: "#CBD5E0", true: "#68D391" }}
            thumbColor={settings.notifyOnCriticalOnly ? Colors.success : "#A0AEC0"}
          />
        </View>
      </View>

      {/* Contacts List Header */}
      <View style={styles.contactsHeaderRow}>
        <Text style={styles.sectionTitle}>Emergency Contacts ({contacts.length})</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={openAddModal}
        >
          <Text style={styles.addBtnText}>+ Add Contact</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 30 }} />
      ) : contacts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 44, marginBottom: 8 }}>👥</Text>
          <Text style={styles.emptyTitle}>No Trusted Contacts Yet</Text>
          <Text style={styles.emptySub}>
            Add family, friends, or trusted neighbors who should be immediately notified with your
            live location whenever you broadcast an SOS.
          </Text>
          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={openAddModal}
          >
            <Text style={styles.emptyAddBtnText}>Add First Contact</Text>
          </TouchableOpacity>
        </View>
      ) : (
        contacts.map((contact) => (
          <View key={contact._id || contact.phone} style={styles.contactCard}>
            <View style={styles.contactTopRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>
                  {contact.name ? contact.name[0].toUpperCase() : "C"}
                </Text>
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <View style={styles.relationBadge}>
                    <Text style={styles.relationText}>{contact.relationship}</Text>
                  </View>
                </View>
                <Text style={styles.contactPhone}>📞 {contact.phone}</Text>
                <View style={styles.channelRow}>
                  {contact.notifyVia?.includes("sms") && (
                    <View style={styles.channelBadge}>
                      <Text style={styles.channelText}>📱 SMS</Text>
                    </View>
                  )}
                  {contact.notifyVia?.includes("whatsapp") && (
                    <View style={[styles.channelBadge, { backgroundColor: "#E8F5E9" }]}>
                      <Text style={[styles.channelText, { color: "#2E7D32" }]}>💬 WhatsApp</Text>
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteContact(contact)}
              >
                <Text style={styles.deleteIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.contactBottomRow}>
              <Text style={styles.contactToggleLabel}>
                {contact.notifyOnSOS ? "Auto-alert on SOS enabled" : "Paused for this contact"}
              </Text>
              <Switch
                value={contact.notifyOnSOS}
                onValueChange={() => handleToggleContactSOS(contact)}
                trackColor={{ false: "#CBD5E0", true: "#68D391" }}
                thumbColor={contact.notifyOnSOS ? Colors.success : "#A0AEC0"}
              />
            </View>
          </View>
        ))
      )}

      {/* Test Alert Button */}
      {contacts.length > 0 && (
        <TouchableOpacity
          style={styles.testAlertBtn}
          onPress={handleSendTestAlert}
          disabled={testingAlert}
        >
          {testingAlert ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.testAlertBtnText}>📲 Test SOS Alert to Trusted Circle</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Add Contact Modal with Choice / Picker / Manual / Configure */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalStep === "choice"
                  ? "Add Trusted Contact"
                  : modalStep === "picker"
                  ? "Select from Device Contacts"
                  : "Configure Contact Details"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {modalStep === "choice" && (
              <View style={{ paddingVertical: 10 }}>
                <Text style={styles.modalSub}>
                  Choose how you want to add a contact to your emergency trusted circle.
                </Text>

                <TouchableOpacity
                  style={styles.choiceOptionBtn}
                  onPress={handlePickFromDeviceContacts}
                  disabled={loadingDeviceContacts}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>📇</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceOptionTitle}>Pick from Device Contacts</Text>
                    <Text style={styles.choiceOptionSub}>
                      Select family, friends or doctors directly from your phone address book.
                    </Text>
                  </View>
                  {loadingDeviceContacts && <ActivityIndicator color={Colors.primary} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.choiceOptionBtn}
                  onPress={() => setModalStep("manual")}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>✏️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceOptionTitle}>Add Manually</Text>
                    <Text style={styles.choiceOptionSub}>
                      Type name and phone number manually.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {modalStep === "picker" && (
              <View style={{ height: 420 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 }}>
                  <TouchableOpacity
                    style={styles.backStepBtn}
                    onPress={() => setModalStep("choice")}
                  >
                    <Text style={styles.backStepText}>← Back</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, marginTop: 0 }]}
                    placeholder="Search by name or phone..."
                    placeholderTextColor="#8898AA"
                    value={deviceSearchQuery}
                    onChangeText={handleSearchDeviceContacts}
                  />
                </View>

                {filteredDeviceContacts.length === 0 ? (
                  <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                    <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
                      No matching contacts found with phone numbers.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredDeviceContacts}
                    keyExtractor={(item) => item.id || item.name}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.deviceContactItem}
                        onPress={() => handleSelectDeviceContact(item)}
                      >
                        <View style={styles.avatarCircleSmall}>
                          <Text style={styles.avatarLetterSmall}>
                            {item.name ? item.name[0].toUpperCase() : "C"}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.deviceContactName}>{item.name}</Text>
                          <Text style={styles.deviceContactPhone}>
                            📞 {item.phoneNumbers?.[0]?.number || "No phone number"}
                          </Text>
                        </View>
                        <Text style={{ color: Colors.primary, fontWeight: "700", fontSize: 13 }}>
                          Select →
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            )}

            {(modalStep === "manual" || modalStep === "configure") && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                {modalStep === "manual" && (
                  <TouchableOpacity
                    style={styles.backStepBtnSmall}
                    onPress={() => setModalStep("choice")}
                  >
                    <Text style={styles.backStepText}>← Back to Options</Text>
                  </TouchableOpacity>
                )}

                {modalStep === "configure" && (
                  <TouchableOpacity
                    style={styles.backStepBtnSmall}
                    onPress={() => setModalStep("picker")}
                  >
                    <Text style={styles.backStepText}>← Choose Another Contact</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.modalSub}>
                  This person will receive instant SMS & WhatsApp alerts with your live tracking link
                  during emergencies.
                </Text>

                <Text style={styles.inputLabel}>Contact Full Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., Mom / Dr. Sarah"
                  placeholderTextColor="#8898AA"
                  value={newName}
                  onChangeText={setNewName}
                />

                <Text style={styles.inputLabel}>Mobile Phone Number *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., +1 555-0199 or 9876543210"
                  placeholderTextColor="#8898AA"
                  keyboardType="phone-pad"
                  value={newPhone}
                  onChangeText={setNewPhone}
                />

                <Text style={styles.inputLabel}>Relationship</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relationScroll}>
                  {RELATIONSHIPS.map((rel) => (
                    <TouchableOpacity
                      key={rel}
                      style={[
                        styles.relationChip,
                        newRelation === rel && styles.relationChipActive,
                      ]}
                      onPress={() => setNewRelation(rel)}
                    >
                      <Text
                        style={[
                          styles.relationChipText,
                          newRelation === rel && styles.relationChipTextActive,
                        ]}
                      >
                        {rel}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Notification Channels</Text>
                <View style={styles.channelsSelectRow}>
                  <TouchableOpacity
                    style={[styles.channelSelectBtn, newSms && styles.channelSelectBtnActive]}
                    onPress={() => setNewSms(!newSms)}
                  >
                    <Text style={[styles.channelSelectText, newSms && styles.channelSelectTextActive]}>
                      📱 SMS Message
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.channelSelectBtn, newWhatsApp && styles.channelSelectBtnActive]}
                    onPress={() => setNewWhatsApp(!newWhatsApp)}
                  >
                    <Text
                      style={[
                        styles.channelSelectText,
                        newWhatsApp && styles.channelSelectTextActive,
                      ]}
                    >
                      💬 WhatsApp Alert
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={handleAddContactSubmit}
                  disabled={addingContact}
                >
                  {addingContact ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Save to Trusted Circle</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  banner: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
  },
  bannerIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  bannerSubtitle: {
    fontSize: 13,
    color: "#A0B2C6",
    marginTop: 6,
    lineHeight: 18,
  },
  statusPillRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusPillActive: {
    backgroundColor: Colors.success,
  },
  statusPillInactive: {
    backgroundColor: "#718096",
  },
  statusPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  countPill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  countPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  cardSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 14,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  controlTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  controlDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 10,
  },
  contactsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  emptyAddBtn: {
    marginTop: 18,
    backgroundColor: Colors.emergency,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  contactCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  contactTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  avatarCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetterSmall: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  contactName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  relationBadge: {
    backgroundColor: "#EDF2F7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  relationText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  contactPhone: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  channelRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  channelBadge: {
    backgroundColor: "#E1F5FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  channelText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0288D1",
  },
  deleteBtn: {
    padding: 8,
  },
  deleteIcon: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: "700",
  },
  contactBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: 12,
    paddingTop: 10,
  },
  contactToggleLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  testAlertBtn: {
    backgroundColor: Colors.emergency,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
    shadowColor: Colors.emergency,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  testAlertBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  modalCloseText: {
    fontSize: 20,
    color: Colors.textSecondary,
    fontWeight: "700",
    padding: 4,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  choiceOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  choiceOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  choiceOptionSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  backStepBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#EDF2F7",
    borderRadius: 8,
  },
  backStepBtnSmall: {
    marginBottom: 12,
  },
  backStepText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  deviceContactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  deviceContactName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  deviceContactPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  relationScroll: {
    flexDirection: "row",
    marginBottom: 8,
  },
  relationChip: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  relationChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  relationChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  relationChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  channelsSelectRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  channelSelectBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  channelSelectBtnActive: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  channelSelectText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  channelSelectTextActive: {
    color: Colors.successDark,
    fontWeight: "700",
  },
  modalSubmitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
