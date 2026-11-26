import { api } from "./api";
import {
  EmergencyTriageData,
  TriageCandidate,
  TriageQueueItem,
} from "../types";

export const getTriageQueue = async (): Promise<TriageQueueItem[]> => {
  const res = await api.get("/admin/emergencies/triage-queue");
  return res.data?.data?.queue || [];
};

export const getEmergencyTriage = async (
  emergencyId: string
): Promise<{ triage: EmergencyTriageData; hasPendingTimer: boolean }> => {
  const res = await api.get(`/admin/emergencies/${emergencyId}/triage`);
  return res.data?.data || { triage: null, hasPendingTimer: false };
};

export const autoDispatchEmergency = async (
  emergencyId: string,
  volunteerId?: string,
  notes?: string
): Promise<{
  success: boolean;
  message: string;
  selectedVolunteer?: TriageCandidate;
}> => {
  const res = await api.post(`/admin/emergencies/${emergencyId}/dispatch`, {
    volunteerId,
    notes,
  });
  return res.data?.data || res.data;
};

export const cancelTriageTimer = async (emergencyId: string): Promise<boolean> => {
  const res = await api.post(`/admin/emergencies/${emergencyId}/cancel-timer`);
  return res.data?.success || false;
};
