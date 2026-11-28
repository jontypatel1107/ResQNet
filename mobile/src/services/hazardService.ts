import { api } from "./api";
import { Hazard, HazardSeverity, HazardType } from "../types";

export interface ReportHazardPayload {
  type: HazardType;
  title: string;
  description?: string;
  severity?: HazardSeverity;
  coordinates: [number, number]; // [longitude, latitude]
  address?: string;
}

export const hazardService = {
  async getHazards(params?: {
    lat?: number;
    lng?: number;
    radius?: number;
    status?: "active" | "cleared" | "all";
  }): Promise<Hazard[]> {
    const searchParams = new URLSearchParams();
    if (params?.lat !== undefined && params?.lng !== undefined) {
      searchParams.append("lat", String(params.lat));
      searchParams.append("lng", String(params.lng));
    }
    if (params?.radius !== undefined) {
      searchParams.append("radius", String(params.radius));
    }
    if (params?.status) {
      searchParams.append("status", params.status);
    }

    const query = searchParams.toString();
    const url = query ? `/hazards?${query}` : "/hazards";
    const res = await api.get(url);
    return res.data?.data?.hazards || [];
  },

  async reportHazard(payload: ReportHazardPayload): Promise<Hazard> {
    const res = await api.post("/hazards", payload);
    return res.data?.data?.hazard;
  },

  async clearHazard(hazardId: string, notes?: string): Promise<Hazard> {
    const res = await api.patch(`/hazards/${hazardId}/clear`, { notes });
    return res.data?.data?.hazard;
  },
};
