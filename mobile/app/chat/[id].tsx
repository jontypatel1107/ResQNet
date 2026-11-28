import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";
import { chatService, ParticipantInfo } from "../../src/services/chatService";
import { getSocket } from "../../src/services/socket";
import { ChatMessage, UserRole } from "../../src/types";
import { Colors } from "../../src/constants/colors";

const QUICK_REPLIES: Record<UserRole, string[]> = {
  citizen: [
    "🆘 I am safe",
    "🚑 Send ambulance",
    "🩸 Bleeding heavily",
    "🚪 Waiting at gate",
    "🧱 Trapped under debris",
    "🔦 Need flashlight / power",
  ],
  volunteer: [
    "🚗 On my way",
    "⏱️ ETA ~5 mins",
    "👋 At the scene, please wave",
    "🩹 Patient stabilized",
    "👥 Need backup responder",
  ],
  admin: [
    "📢 Dispatch monitoring channel",
    "🚑 Ambulance is en route",
    "🛡️ Stay calm, help is near",
  ],
};

const ROLE_BADGE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  citizen: { bg: "rgba(49, 130, 206, 0.15)", text: "#63B3ED", label: "Citizen" },
  volunteer: { bg: "rgba(46, 213, 115, 0.15)", text: "#2ED573", label: "Volunteer" },
  admin: { bg: "rgba(159, 122, 234, 0.15)", text: "#B794F4", label: "Dispatch" },
};

export default function MissionChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    citizenName?: string;
    volunteerName?: string;
  }>();
  const emergencyId = params.id || "";

  const { user, role } = useAuthStore();
  const currentUserId = user?.id || (user as { _id?: string })?._id || "";
  const currentRole: UserRole = role || "citizen";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [citizenInfo, setCitizenInfo] = useState<ParticipantInfo | null>(
    params.citizenName ? { id: "", name: params.citizenName } : null
  );
  const [volunteerInfo, setVolunteerInfo] = useState<ParticipantInfo | null>(
    params.volunteerName ? { id: "", name: params.volunteerName } : null
  );

  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Fetch message history & connect to room
  useEffect(() => {
    if (!emergencyId) return;

    let isMounted = true;
    const fetchHistory = async () => {
      try {
        const historyData = await chatService.getMessages(emergencyId);
        if (isMounted) {
          setMessages(historyData.messages);
          if (historyData.citizen?.name) {
            setCitizenInfo(historyData.citizen);
          }
          if (historyData.volunteer?.name) {
            setVolunteerInfo(historyData.volunteer);
          }
        }
      } catch (err) {
        console.warn("[Chat] Failed to load messages:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchHistory();

    const socket = getSocket();
    socket.emit("join_emergency", { emergencyId });

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.emergencyId === emergencyId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on("new_message", handleNewMessage);

    return () => {
      isMounted = false;
      socket.emit("leave_emergency", { emergencyId });
      socket.off("new_message", handleNewMessage);
    };
  }, [emergencyId]);

  const handleSend = useCallback(
    async (textToSend?: string, isQuickReply: boolean = false) => {
      const content = (textToSend || inputText).trim();
      if (!content || !emergencyId || sending) return;

      if (!textToSend) setInputText("");
      setSending(true);

      try {
        const created = await chatService.sendMessage(emergencyId, content, isQuickReply);
        if (created) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === created._id)) return prev;
            return [...prev, created];
          });
        }
      } catch (err) {
        console.warn("[Chat] Send failed:", err);
      } finally {
        setSending(false);
      }
    },
    [emergencyId, inputText, sending]
  );

  const quickOptions = QUICK_REPLIES[currentRole] || QUICK_REPLIES.citizen;

  // Determine counterpart display name for header
  const headerDisplayName =
    currentRole === "volunteer"
      ? `👤 Citizen: ${citizenInfo?.name || "Requester"}`
      : currentRole === "citizen"
      ? `🚑 Responder: ${volunteerInfo?.name || "Assigned Responder"}`
      : `👤 ${citizenInfo?.name || "Citizen"} ↔ 🚑 ${volunteerInfo?.name || "Responder"}`;

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === currentUserId;
    const roleInfo = ROLE_BADGE_COLORS[item.senderRole] || ROLE_BADGE_COLORS.citizen;
    const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View style={[styles.bubbleRow, isMe ? styles.myRow : styles.otherRow]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe ? (
            <View style={styles.senderHeader}>
              <Text style={styles.senderName}>{item.senderName}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleInfo.bg }]}>
                <Text style={[styles.roleText, { color: roleInfo.text }]}>{roleInfo.label}</Text>
              </View>
            </View>
          ) : null}

          <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>
            {item.message}
          </Text>

          <View style={styles.metaRow}>
            {item.isQuickReply ? (
              <View style={styles.quickBadge}>
                <Text style={styles.quickBadgeText}>⚡ Quick</Text>
              </View>
            ) : null}
            <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.otherTimestamp]}>
              {timeStr}
            </Text>
            {/* Delivery checkmark icon for trust and realism */}
            {isMe ? <Text style={styles.deliveryCheck}>✓✓</Text> : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header with Counterpart Name */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerDisplayName}
            </Text>
            <View style={styles.liveIndicatorRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                {currentRole === "citizen" && volunteerInfo?.verified
                  ? "✓ Verified Responder • "
                  : ""}
                Live Emergency Channel
              </Text>
            </View>
          </View>
        </View>

        {/* Trust & Security Banner */}
        <View style={styles.trustBanner}>
          <Text style={styles.trustBannerIcon}>🛡️</Text>
          <Text style={styles.trustBannerText}>
            Official ResQNet Secure Dispatch • Messages logged for emergency safety
          </Text>
        </View>

        {/* Message List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Connecting to mission channel...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>
              {currentRole === "volunteer"
                ? `Direct Line with ${citizenInfo?.name || "Citizen"}`
                : `Direct Line with ${volunteerInfo?.name || "Assigned Responder"}`}
            </Text>
            <Text style={styles.emptySub}>
              Direct real-time emergency channel. Tap a quick reply below or type a message to coordinate.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* 1-Tap Quick Action Replies */}
        <View style={styles.quickRepliesContainer}>
          <Text style={styles.quickRepliesHeader}>⚡ 1-Tap Quick Action Replies:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {quickOptions.map((text, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.chip}
                onPress={() => handleSend(text, true)}
                disabled={sending}
              >
                <Text style={styles.chipText}>{text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type emergency message..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendBtnText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backBtnText: {
    color: Colors.info,
    fontWeight: "700",
    fontSize: 14,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  liveIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#2ED573",
  },
  liveText: {
    fontSize: 11,
    color: "#2ED573",
    fontWeight: "600",
  },
  trustBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(49, 130, 206, 0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(49, 130, 206, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
  },
  trustBannerIcon: {
    fontSize: 12,
  },
  trustBannerText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "600",
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  messagesList: {
    padding: 16,
    gap: 12,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  myRow: {
    justifyContent: "flex-end",
  },
  otherRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 2,
  },
  senderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myText: {
    color: "#FFFFFF",
  },
  otherText: {
    color: Colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  quickBadge: {
    backgroundColor: "rgba(255, 187, 0, 0.2)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  quickBadgeText: {
    fontSize: 9,
    color: "#FFBB00",
    fontWeight: "700",
  },
  timestamp: {
    fontSize: 10,
  },
  myTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  otherTimestamp: {
    color: Colors.textMuted,
  },
  deliveryCheck: {
    fontSize: 11,
    color: "#4FD1C5",
    fontWeight: "900",
    marginLeft: 2,
  },
  quickRepliesContainer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    paddingBottom: 6,
  },
  quickRepliesHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(49, 130, 206, 0.12)",
    borderColor: "rgba(49, 130, 206, 0.4)",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.info,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    color: Colors.textPrimary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
