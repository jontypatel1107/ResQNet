import { api } from "./api";
import { VolunteerProfile } from "../types";

export const volunteerService = {
  async getProfile(): Promise<VolunteerProfile | null> {
    const res = await api.get("/volunteers/profile");
    return res.data?.data?.profile || null;
  },

  async toggleDutyStatus(
    onDuty?: boolean
  ): Promise<{ profile: VolunteerProfile; onDuty: boolean }> {
    const payload = typeof onDuty === "boolean" ? { onDuty, availability: onDuty } : {};
    const res = await api.patch("/volunteers/duty-status", payload);
    return res.data?.data;
  },

  async updateStatus(data: Partial<VolunteerProfile>): Promise<VolunteerProfile> {
    const res = await api.put("/volunteers/status", data);
    return res.data?.data?.profile;
  },
};
