import { api } from "./api";
import { PublicEmergencyTracking } from "../types";

export interface LocationPingPayload {
  coordinates: [number, number]; // [longitude, latitude]
  heading?: number;
  speed?: number; // km/h
}

export const trackingService = {
  async getTracking(emergencyId: string): Promise<PublicEmergencyTracking | null> {
    const res = await api.get(`/emergencies/track/${emergencyId}?format=json`);
    if (res.data?.success && res.data.data?.tracking) {
      return res.data.data.tracking;
    }
    return null;
  },

  async sendLocationPing(emergencyId: string, payload: LocationPingPayload) {
    const res = await api.post(`/emergencies/${emergencyId}/location-ping`, payload);
    return res.data;
  },
};
