import { api } from "./api";
import { TrustedContact, TrustedCircleSettings, PublicEmergencyTracking } from "../types";

export const getTrustedCircle = async (): Promise<{
  contacts: TrustedContact[];
  settings: TrustedCircleSettings;
}> => {
  const res = await api.get("/users/trusted-circle");
  return res.data.data;
};

export const addTrustedContact = async (
  contact: Omit<TrustedContact, "_id" | "createdAt">
): Promise<TrustedContact[]> => {
  const res = await api.post("/users/trusted-contacts", contact);
  return res.data.data.contacts;
};

export const updateTrustedContact = async (
  contactId: string,
  contact: Partial<TrustedContact>
): Promise<TrustedContact[]> => {
  const res = await api.put(`/users/trusted-contacts/${contactId}`, contact);
  return res.data.data.contacts;
};

export const deleteTrustedContact = async (contactId: string): Promise<TrustedContact[]> => {
  const res = await api.delete(`/users/trusted-contacts/${contactId}`);
  return res.data.data.contacts;
};

export const updateTrustedCircleSettings = async (
  settings: Partial<TrustedCircleSettings>
): Promise<TrustedCircleSettings> => {
  const res = await api.patch("/users/trusted-circle/settings", settings);
  return res.data.data.settings;
};

export const sendTestAlert = async (): Promise<any> => {
  const res = await api.post("/users/trusted-circle/test-alert");
  return res.data.data;
};

export const getPublicEmergencyTrack = async (id: string): Promise<PublicEmergencyTracking> => {
  const res = await api.get(`/emergencies/track/${id}`);
  return res.data.data.tracking;
};
