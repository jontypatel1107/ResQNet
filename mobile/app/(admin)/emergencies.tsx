import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  getTriageQueue,
  getEmergencyTriage,
  autoDispatchEmergency,
  cancelTriageTimer,
} from "../../src/services/triageService";
import { getSocket } from "../../src/services/socket";
import {
  EmergencyPriority,
  EmergencyTriageData,
  TriageQueueItem,
} from "../../src/types";
import { Colors } from "../../src/constants/colors";

const PRIORITY_FILTERS: ("all" | EmergencyPriority)[] = [
  "all",
  "critical",
  "high",
  "medium",
  "normal",
];

const CATEGORY_ICONS: Record<string, string> = {
  medical: "🚑",
  rescue: "🛶",
  food: "🍲",
  water: "💧",
  transportation: "🚐",
  other: "🆘",
};

export default function AdminEmergencyTriageScreen() {
  const [queue, setQueue] = useState<TriageQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<"all" | EmergencyPriority>("all");

  // Modal / Triage State
  const [selectedEmergency, setSelectedEmergency] = useState<TriageQueueItem | null>(null);
  const [triageData, setTriageData] = useState<EmergencyTriageData | null>(null);
  const [hasPendingTimer, setHasPendingTimer] = useState(false);
  const [loadingTriage, setLoadingTriage] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const items = await getTriageQueue();
      setQueue(items);
    } catch (err: any) {
      console.warn("Could not load triage queue:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchQueue();

      const socket = getSocket();
      const onNewEmergency = () => fetchQueue();
      const onEmergencyUpdated = () => fetchQueue();
      const onTriageDispatched = () => fetchQueue();

      socket.on("new_emergency", onNewEmergency);
      socket.on("emergency_updated", onEmergencyUpdated);
      socket.on("triage_dispatched", onTriageDispatched);

      return () => {
        socket.off("new_emergency", onNewEmergency);
        socket.off("emergency_updated", onEmergencyUpdated);
        socket.off("triage_dispatched", onTriageDispatched);
      };
    }, [fetchQueue])
  );

  const handleOpenTriage = async (item: TriageQueueItem) => {
    setSelectedEmergency(item);
    setLoadingTriage(true);
    setTriageData(null);
    setExpandedCandidateId(null);

    try {
      const data = await getEmergencyTriage(item._id);
      setTriageData(data.triage);
      setHasPendingTimer(data.hasPendingTimer);
      if (data.triage?.candidates?.[0]) {
        setExpandedCandidateId(data.triage.candidates[0].volunteerId);
      }
    } catch (err: any) {
      Alert.alert("Triage Error", err.response?.data?.message || "Could not score volunteers.");
    } finally {
      setLoadingTriage(false);
    }
  };

  const handleDispatch = async (volunteerId?: string, candidateName?: string) => {
    if (!selectedEmergency) return;

    const actionText = volunteerId
      ? `Assign ${candidateName || "this volunteer"} to this emergency?`
      : "Auto-dispatch the top-scored candidate to this emergency?";

    Alert.alert("Confirm Dispatch", actionText, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Dispatch Now",
        style: "destructive",
        onPress: async () => {
          try {
            setDispatching(true);
            const res = await autoDispatchEmergency(selectedEmergency._id, volunteerId);
            if (res.success) {
              Alert.alert(
                "Dispatch Successful! 🚀",
                `${res.selectedVolunteer?.name || "Volunteer"} has been assigned (Score: ${res.selectedVolunteer?.totalScore || 0}/100). Notifications sent.`
              );
              setSelectedEmergency(null);
              fetchQueue();
            } else {
              Alert.alert("Dispatch Failed", res.message || "Could not assign responder.");
            }
          } catch (err: any) {
            Alert.alert("Error", err.response?.data?.message || "Failed to dispatch responder.");
          } finally {
            setDispatching(false);
          }
        },
      },
    ]);
  };

  const handleCancelTimer = async () => {
    if (!selectedEmergency) return;
    try {
      await cancelTriageTimer(selectedEmergency._id);
      setHasPendingTimer(false);
      Alert.alert("Timer Cancelled", "Automated timeout dispatch cancelled for this incident.");
    } catch {
      Alert.alert("Error", "Could not cancel auto-dispatch timer.");
    }
  };

  const filteredQueue = queue.filter((item) => {
    if (priorityFilter === "all") return true;
    return item.priority === priorityFilter;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return Colors.emergency;
      case "high":
        return Colors.warning;
      case "medium":
        return Colors.info;
      default:
        return "#718096";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Overview Card */}
      <View style={styles.headerBanner}>
        <View style={styles.headerRow}>
          <Text style={styles.headerIcon}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Smart Triage Engine</Text>
            <Text style={styles.headerSubtitle}>
              Multi-factor scoring: Proximity + Skill Match + Verification + Workload
            </Text>
          </View>
        </View>

        {/* Priority Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {PRIORITY_FILTERS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.filterPill,
                priorityFilter === p && styles.filterPillActive,
                p === "critical" && styles.filterPillCritical,
              ]}
              onPress={() => setPriorityFilter(p)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  priorityFilter === p && styles.filterPillTextActive,
                ]}
              >
                {p.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Triage Queue List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Analyzing live emergency queue...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchQueue();
              }}
            />
          }
        >
          {filteredQueue.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 36 }}>🛡️</Text>
              <Text style={styles.emptyTitle}>Queue Cleared</Text>
              <Text style={styles.emptyText}>
                No pending or unassigned emergencies matching the selected priority filter.
              </Text>
            </View>
          ) : (
            filteredQueue.map((item) => {
              const pColor = getPriorityColor(item.priority);
              const catIcon = CATEGORY_ICONS[item.category] || "🆘";

              return (
                <View key={item._id} style={[styles.queueCard, { borderLeftColor: pColor }]}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeIcon}>{catIcon}</Text>
                      <Text style={styles.catBadgeText}>{item.category.toUpperCase()}</Text>
                    </View>

                    <View style={[styles.priorityBadge, { backgroundColor: pColor }]}>
                      <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={styles.incidentTitle}>{item.title}</Text>
                  {item.description ? (
                    <Text style={styles.incidentDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  <Text style={styles.locationText}>
                    📍 {item.address || "Coordinates captured"}
                  </Text>

                  {item.hasPendingTimer ? (
                    <View style={styles.timerBadge}>
                      <Text style={styles.timerDot}>●</Text>
                      <Text style={styles.timerText}>
                        Auto-dispatching to top responder in ~60s if unclaimed
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <Text style={styles.timestamp}>
                      Logged {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>

                    <TouchableOpacity
                      style={styles.triageBtn}
                      onPress={() => handleOpenTriage(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.triageBtnText}>⚡ Score & Dispatch →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Triage & Candidate Score Breakdown Modal */}
      <Modal
        visible={selectedEmergency !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedEmergency(null)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Intelligent Triage Ranking</Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {selectedEmergency?.title} ({selectedEmergency?.category.toUpperCase()})
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedEmergency(null)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loadingTriage ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Running geospatial & skill scoring algorithms...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalContent}>
              {/* Emergency Summary Box */}
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Priority / Category:</Text>
                  <Text style={[styles.summaryVal, { color: getPriorityColor(selectedEmergency?.priority || "medium") }]}>
                    {selectedEmergency?.priority.toUpperCase()} • {selectedEmergency?.category.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Address / Area:</Text>
                  <Text style={styles.summaryVal} numberOfLines={1}>
                    {selectedEmergency?.address || "Coordinates"}
                  </Text>
                </View>

                {hasPendingTimer ? (
                  <View style={styles.modalTimerRow}>
                    <Text style={styles.modalTimerText}>⏱️ Auto-Dispatch Timer Active (60s)</Text>
                    <TouchableOpacity onPress={handleCancelTimer}>
                      <Text style={styles.cancelTimerBtn}>Cancel Timer</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              {/* Quick Auto-Dispatch Button */}
              {triageData && triageData.candidates.length > 0 ? (
                <TouchableOpacity
                  style={styles.autoDispatchBtn}
                  onPress={() => handleDispatch()}
                  disabled={dispatching}
                  activeOpacity={0.8}
                >
                  {dispatching ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.autoDispatchBtnText}>
                      ⚡ AUTO-DISPATCH BEST RESPONDER ({triageData.candidates[0].name} - {triageData.candidates[0].totalScore} pts)
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}

              {/* Candidates Header */}
              <View style={styles.candidatesHeaderRow}>
                <Text style={styles.candidatesTitle}>
                  Available Responder Candidates ({triageData?.candidatesCount || 0})
                </Text>
                <Text style={styles.candidatesSubtitle}>Ranked by composite triage score</Text>
              </View>

              {/* Candidates List */}
              {triageData?.candidates.length === 0 ? (
                <View style={styles.noCandidatesBox}>
                  <Text style={{ fontSize: 32 }}>⚠️</Text>
                  <Text style={styles.noCandidatesTitle}>No Volunteers Available</Text>
                  <Text style={styles.noCandidatesText}>
                    No active volunteers within their service radius have their availability toggled on.
                  </Text>
                </View>
              ) : (
                triageData?.candidates.map((candidate, idx) => {
                  const isTopMatch = idx === 0;
                  const isExpanded = expandedCandidateId === candidate.volunteerId;

                  return (
                    <View
                      key={candidate.volunteerId}
                      style={[
                        styles.candidateCard,
                        isTopMatch && styles.candidateCardTop,
                      ]}
                    >
                      {/* Top Rank Badge */}
                      <View style={styles.candidateTopRow}>
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankBadgeText}>
                            {isTopMatch ? "★ #1 OPTIMAL MATCH" : `#${idx + 1}`}
                          </Text>
                        </View>

                        {/* Total Score Badge */}
                        <View
                          style={[
                            styles.scoreBadge,
                            {
                              backgroundColor:
                                candidate.totalScore >= 80
                                  ? Colors.success
                                  : candidate.totalScore >= 50
                                  ? Colors.warning
                                  : "#A0AEC0",
                            },
                          ]}
                        >
                          <Text style={styles.scoreBadgeText}>
                            {candidate.totalScore} / 100 PTS
                          </Text>
                        </View>
                      </View>

                      {/* Volunteer Name & Meta */}
                      <Text style={styles.candidateName}>{candidate.name}</Text>
                      <Text style={styles.candidateContact}>
                        📞 {candidate.phone} • {candidate.email}
                      </Text>

                      {/* Factor Chips */}
                      <View style={styles.chipsRow}>
                        <View style={styles.chip}>
                          <Text style={styles.chipText}>
                            📍 {candidate.distanceKm !== null ? `${candidate.distanceKm} km` : "Unknown"}
                          </Text>
                        </View>

                        {candidate.verified ? (
                          <View style={[styles.chip, styles.chipVerified]}>
                            <Text style={styles.chipVerifiedText}>✓ Verified</Text>
                          </View>
                        ) : null}

                        <View style={styles.chip}>
                          <Text style={styles.chipText}>
                            ⚡ {candidate.activeWorkload} active missions
                          </Text>
                        </View>
                      </View>

                      {/* Matched Skills */}
                      {candidate.breakdown.matchedSkills.length > 0 ? (
                        <View style={styles.matchedSkillsRow}>
                          <Text style={styles.matchedSkillsLabel}>Skills:</Text>
                          {candidate.breakdown.matchedSkills.map((sk) => (
                            <View key={sk} style={styles.skillPill}>
                              <Text style={styles.skillPillText}>{sk.replace(/_/g, " ")}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {/* Toggle Breakdown Button */}
                      <TouchableOpacity
                        style={styles.toggleBreakdownBtn}
                        onPress={() =>
                          setExpandedCandidateId(isExpanded ? null : candidate.volunteerId)
                        }
                      >
                        <Text style={styles.toggleBreakdownText}>
                          {isExpanded ? "Hide Score Breakdown ▲" : "View Score Breakdown ▼"}
                        </Text>
                      </TouchableOpacity>

                      {/* Expandable Breakdown Drawer */}
                      {isExpanded ? (
                        <View style={styles.breakdownDrawer}>
                          <View style={styles.breakdownItem}>
                            <View style={styles.breakdownItemHeader}>
                              <Text style={styles.breakdownItemTitle}>📍 Proximity & Radius</Text>
                              <Text style={styles.breakdownItemScore}>
                                {candidate.breakdown.distanceScore} / 40 pts
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${(candidate.breakdown.distanceScore / 40) * 100}%` },
                                ]}
                              />
                            </View>
                          </View>

                          <View style={styles.breakdownItem}>
                            <View style={styles.breakdownItemHeader}>
                              <Text style={styles.breakdownItemTitle}>🛠️ Skill Alignment</Text>
                              <Text style={styles.breakdownItemScore}>
                                {candidate.breakdown.skillScore} / 30 pts
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${(candidate.breakdown.skillScore / 30) * 100}%` },
                                ]}
                              />
                            </View>
                          </View>

                          <View style={styles.breakdownItem}>
                            <View style={styles.breakdownItemHeader}>
                              <Text style={styles.breakdownItemTitle}>🛡️ Platform Verification</Text>
                              <Text style={styles.breakdownItemScore}>
                                {candidate.breakdown.verificationScore} / 15 pts
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${(candidate.breakdown.verificationScore / 15) * 100}%` },
                                ]}
                              />
                            </View>
                          </View>

                          <View style={styles.breakdownItem}>
                            <View style={styles.breakdownItemHeader}>
                              <Text style={styles.breakdownItemTitle}>⚡ Workload Availability</Text>
                              <Text style={styles.breakdownItemScore}>
                                {candidate.breakdown.workloadScore} / 15 pts
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${(candidate.breakdown.workloadScore / 15) * 100}%` },
                                ]}
                              />
                            </View>
                          </View>

                          {/* Reasons List */}
                          <View style={styles.reasonsBox}>
                            <Text style={styles.reasonsHeader}>Triage Factors:</Text>
                            {candidate.breakdown.reasons.map((r, i) => (
                              <Text key={i} style={styles.reasonBullet}>
                                • {r}
                              </Text>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      {/* Assign This Candidate Button */}
                      <TouchableOpacity
                        style={styles.assignIndividualBtn}
                        onPress={() =>
                          handleDispatch(candidate.volunteerId, candidate.name)
                        }
                        disabled={dispatching}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.assignIndividualText}>
                          Assign {candidate.name.split(" ")[0]}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBanner: {
    backgroundColor: Colors.surface,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerIcon: {
    fontSize: 26,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#EDF2F7",
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
  },
  filterPillCritical: {
    borderColor: Colors.emergencyLight,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: "center",
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  queueCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  catBadgeIcon: {
    fontSize: 14,
    marginRight: 5,
  },
  catBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  incidentTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  incidentDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FEB2B2",
    marginBottom: 10,
  },
  timerDot: {
    color: Colors.emergency,
    fontSize: 12,
    marginRight: 6,
  },
  timerText: {
    color: Colors.emergencyDark,
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EDF2F7",
  },
  timestamp: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  triageBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  triageBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EDF2F7",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
    maxWidth: "60%",
    textAlign: "right",
  },
  modalTimerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EDF2F7",
  },
  modalTimerText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.emergency,
  },
  cancelTimerBtn: {
    fontSize: 11,
    color: Colors.textSecondary,
    textDecorationLine: "underline",
  },
  autoDispatchBtn: {
    backgroundColor: Colors.emergency,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: Colors.emergency,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  autoDispatchBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  candidatesHeaderRow: {
    marginBottom: 12,
  },
  candidatesTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  candidatesSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  noCandidatesBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noCandidatesTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 8,
  },
  noCandidatesText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  candidateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  candidateCardTop: {
    borderColor: "#68D391",
    borderWidth: 1.5,
    backgroundColor: "#F0FFF4",
  },
  candidateTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rankBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rankBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scoreBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  candidateName: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  candidateContact: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: "#EDF2F7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  chipVerified: {
    backgroundColor: "#C6F6D5",
  },
  chipVerifiedText: {
    fontSize: 11,
    color: "#22543D",
    fontWeight: "700",
  },
  matchedSkillsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 10,
  },
  matchedSkillsLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
    marginRight: 4,
  },
  skillPill: {
    backgroundColor: "#EBF8FF",
    borderWidth: 1,
    borderColor: "#BEE3F8",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skillPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2B6CB0",
  },
  toggleBreakdownBtn: {
    paddingVertical: 6,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#EDF2F7",
    marginTop: 4,
  },
  toggleBreakdownText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  breakdownDrawer: {
    backgroundColor: "#F7FAFC",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  breakdownItem: {
    marginBottom: 8,
  },
  breakdownItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  breakdownItemTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  breakdownItemScore: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  progressBarBg: {
    height: 5,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
  },
  reasonsBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  reasonsHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  reasonBullet: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  assignIndividualBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  assignIndividualText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
