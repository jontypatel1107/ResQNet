import { api } from "./api";
import { SafetyStatus, PublicSafetyResult } from "../types";

export const safetyService = {
  async getMySafetyStatus(): Promise<SafetyStatus> {
    const res = await api.get("/users/safety-status");
    if (res.data?.success && res.data.data?.safetyStatus) {
      return res.data.data.safetyStatus;
    }
    return { status: "unknown", lastCheckIn: null };
  },

  async recordCheckIn(payload: {
    status: "safe" | "in_danger" | "needs_assistance";
    address?: string;
    coordinates?: [number, number];
    note?: string;
    notifyCircle?: boolean;
  }): Promise<{ safetyStatus: SafetyStatus; circleResult?: { contactsNotified: number } }> {
    const res = await api.post("/users/safety-checkin", payload);
    return res.data?.data;
  },

  async lookupPublicStatus(phone: string): Promise<PublicSafetyResult> {
    const res = await api.get(`/users/public-safety-status?phone=${encodeURIComponent(phone)}`);
    if (res.data?.success && res.data.data) {
      return res.data.data;
    }
    return { found: false };
  },
};
